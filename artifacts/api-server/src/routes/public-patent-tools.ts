import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import nodemailer from "nodemailer";
import {
  AnalyzePublicExaminerBody,
  AnalyzePublicExaminerResponse,
  AnalyzePublicPortfolioBody,
  AnalyzePublicPortfolioResponse,
  SubmitPublicToolInquiryBody,
  SubmitPublicToolInquiryResponse,
} from "@workspace/api-zod";
import { analyzeExaminer, analyzePortfolio, PublicPatentToolError } from "../lib/public-patent-tools";

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
    res.status(400).json({ error: "Enter a company name between 2 and 120 characters." });
    return;
  }
  try {
    res.json(AnalyzePublicPortfolioResponse.parse(await analyzePortfolio(parsed.data.companyName)));
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
    res.json(AnalyzePublicExaminerResponse.parse(await analyzeExaminer(parsed.data.query)));
  } catch (error) {
    sendToolError(res, error);
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

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const toEmail = process.env.PUBLIC_TOOLS_CONTACT_EMAIL ?? process.env.CONTACT_EMAIL ?? "britten@zilkakotab.com";
  if (!smtpHost || !smtpUser || !smtpPass) {
    req.log.error("SMTP environment variables not configured for public tool inquiry");
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
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      requireTLS: smtpPort !== 465,
      auth: { type: "login", user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
    });
    await transporter.sendMail({
      from: `"Zilka-Kotab Website" <${smtpUser}>`,
      to: toEmail,
      replyTo: `"${safe.name}" <${parsed.data.email}>`,
      subject: `Patent Intelligence Inquiry — ${toolName}`,
      html: `<div style="font-family:sans-serif;max-width:640px">
        <h2>New ${escapeHtml(toolName)} inquiry</h2>
        <p><strong>Name:</strong> ${safe.name}</p>
        <p><strong>Company:</strong> ${safe.company}</p>
        <p><strong>Business email:</strong> <a href="mailto:${safe.email}">${safe.email}</a></p>
        ${safe.message ? `<p><strong>Message:</strong><br>${safe.message.replace(/\n/g, "<br>")}</p>` : ""}
      </div>`,
    });
    req.log.info({ tool: parsed.data.tool }, "Public patent tool inquiry sent");
    res.json(SubmitPublicToolInquiryResponse.parse({ success: true }));
  } catch (error) {
    req.log.error({ err: error, tool: parsed.data.tool }, "Failed to send public patent tool inquiry");
    res.status(500).json({ error: "We could not send your request. Please try again later." });
  }
});

export default router;
