import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { deliverMail, MailDeliveryTimeoutError } from "../lib/mail-delivery";
import {
  AnalyzePublicExaminerBody,
  AnalyzePublicExaminerResponse,
  AnalyzePublicPortfolioBody,
  AnalyzePublicPortfolioResponse,
  SubmitPublicToolInquiryBody,
  SubmitPublicToolInquiryResponse,
} from "@workspace/api-zod";
import { analyzeExaminer, analyzePortfolio, analyzePortfolioAdvanced, PublicPatentToolError, requestUspto } from "../lib/public-patent-tools";
import { getExaminerRateJob } from "../lib/examiner-rce-store";

const router: IRouter = Router();
const SEARCH_WINDOW_MS = 15 * 60 * 1000;
const INQUIRY_WINDOW_MS = 60 * 60 * 1000;
const attempts = new Map<string, { count: number; resetsAt: number }>();

function rateLimit(scope: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${scope}:${req.ip || "unknown"}`;
    const now = Date.now();
    const current = attempts.get(key);
    if (!current || current.resetsAt <= now) {
      attempts.set(key, { count: 1, resetsAt: now + windowMs });
      next();
      return;
    }
    current.count += 1;
    if (current.count > limit) {
      res.setHeader("Retry-After", Math.ceil((current.resetsAt - now) / 1000));
      res.status(429).json({ error: "Too many requests. Please wait before trying again." });
      return;
    }
    next();
  };
}

function sendToolError(res: Response, error: unknown) {
  if (error instanceof PublicPatentToolError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  throw error;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

router.post("/public-tools/portfolio/analyze", rateLimit("portfolio", 10, SEARCH_WINDOW_MS), async (req, res): Promise<void> => {
  const parsed = AnalyzePublicPortfolioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a company name (2–120 characters), up to 50 additional names (2–200 characters each), and at most 500 selected applicant names." });
    return;
  }
  try {
    res.json(AnalyzePublicPortfolioResponse.parse(await analyzePortfolio(parsed.data.companyName, parsed.data.selectedApplicantNames, parsed.data.additionalCompanyNames)));
  } catch (error) {
    sendToolError(res, error);
  }
});

router.post("/public-tools/portfolio/advanced", rateLimit("portfolio-advanced", 4, SEARCH_WINDOW_MS), async (req, res): Promise<void> => {
  const names = req.body?.selectedApplicantNames;
  if (!Array.isArray(names) || names.length < 1 || names.length > 500 ||
    names.some((name: unknown) => typeof name !== "string" || name.trim().length < 2 || name.trim().length > 200)) {
    res.status(400).json({ error: "Select one or more valid applicant names first." });
    return;
  }
  try {
    res.json(await analyzePortfolioAdvanced(names as string[]));
  } catch (error) {
    sendToolError(res, error);
  }
});

router.post("/public-tools/examiner/analyze", rateLimit("examiner", 10, SEARCH_WINDOW_MS), async (req, res): Promise<void> => {
  const parsed = AnalyzePublicExaminerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter an examiner name or four-digit art unit." });
    return;
  }
  try {
    res.json(AnalyzePublicExaminerResponse.parse(await analyzeExaminer(parsed.data.query, parsed.data.selectedExaminerName)));
  } catch (error) {
    sendToolError(res, error);
  }
});

router.get("/public-tools/examiner/rce-continuation/:jobId", rateLimit("examiner-rates", 90, 60_000), async (req, res): Promise<void> => {
  const id = String(req.params.jobId);
  if (!/^[a-f0-9]{64}$/.test(id)) { res.status(400).json({ error: "Invalid analysis identifier." }); return; }
  try {
    const result = await getExaminerRateJob(id, requestUspto);
    if (!result) { res.status(404).json({ error: "Analysis not found. Run the examiner search again." }); return; }
    res.setHeader("Cache-Control", "no-store");
    res.json(result);
  } catch {
    res.status(503).json({ error: "Evidence analysis is temporarily unavailable; other examiner metrics remain available." });
  }
});

router.post("/public-tools/inquiry", rateLimit("inquiry", 5, INQUIRY_WINDOW_MS), async (req, res): Promise<void> => {
  const parsed = SubmitPublicToolInquiryBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.consent) {
    res.status(400).json({ error: "Complete the required fields and consent to being contacted." });
    return;
  }
  if (parsed.data.website) {
    res.json(SubmitPublicToolInquiryResponse.parse({ success: true }));
    return;
  }

  const toEmail = process.env.PUBLIC_TOOLS_CONTACT_EMAIL ?? process.env.CONTACT_EMAIL ?? "britten@zilkakotab.com";
  if (!process.env.CONTACT_OUTLOOK_CONNECTION_ID || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    req.log.error({ code: "OUTLOOK_NOT_CONFIGURED" }, "Public tool email service is not configured");
    res.status(500).json({ error: "Inquiry delivery is not configured." });
    return;
  }

  const toolName = parsed.data.tool === "portfolio-analyzer" ? "Patent Portfolio Analyzer" : "Patent Examiner Intelligence";
  const safe = {
    name: escapeHtml(parsed.data.name),
    company: escapeHtml(parsed.data.company),
    email: escapeHtml(parsed.data.email),
    message: escapeHtml(parsed.data.message ?? ""),
  };
  try {
    const acceptance = await deliverMail({
      to: toEmail,
      replyTo: { name: parsed.data.name.replace(/[\r\n]/g, " "), address: parsed.data.email },
      subject: `Patent Intelligence Inquiry — ${toolName}`,
      html: `<div style="font-family:sans-serif;max-width:640px">
        <h2>New ${escapeHtml(toolName)} inquiry</h2>
        <p><strong>Name:</strong> ${safe.name}</p>
        <p><strong>Company:</strong> ${safe.company}</p>
        <p><strong>Business email:</strong> <a href="mailto:${safe.email}">${safe.email}</a></p>
        ${safe.message ? `<p><strong>Message:</strong><br>${safe.message.replace(/\n/g, "<br>")}</p>` : ""}
      </div>`,
    });
    req.log.info({ ...acceptance, tool: parsed.data.tool }, "Public patent tool inquiry accepted by Microsoft 365");
    res.json(SubmitPublicToolInquiryResponse.parse({ success: true }));
  } catch (error) {
    const failure = error as { code?: string; providerStatus?: number; providerRequestId?: string };
    req.log.error({
      code: failure?.code, providerStatus: failure?.providerStatus,
      providerRequestId: failure?.providerRequestId, tool: parsed.data.tool,
    }, "Failed to send public patent tool inquiry");
    res.status(error instanceof MailDeliveryTimeoutError ? 504 : 502).json({
      error: "We could not confirm your request was sent. Please call (408) 971-2573 rather than submitting it repeatedly.",
    });
  }
});

export default router;
