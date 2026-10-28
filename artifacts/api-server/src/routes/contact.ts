import { Router } from "express";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

const router = Router();
const rateWindows = new Map<string, { count: number; resetsAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

router.post("/contact", async (req, res): Promise<void> => {
  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const website = typeof body.website === "string" ? body.website.trim() : "";
  const consent = body.consent === true;

  if (website) {
    res.json({ success: true });
    return;
  }

  const rateKey = req.ip || "unknown";
  const now = Date.now();
  const current = rateWindows.get(rateKey);
  if (current && current.resetsAt > now && current.count >= MAX_ATTEMPTS) {
    res.setHeader("Retry-After", Math.ceil((current.resetsAt - now) / 1000));
    res.status(429).json({ error: "Too many messages were submitted. Please try again later." });
    return;
  }
  if (!current || current.resetsAt <= now) rateWindows.set(rateKey, { count: 1, resetsAt: now + WINDOW_MS });
  else current.count += 1;
  if (rateWindows.size > 1000) {
    for (const [key, window] of rateWindows) if (window.resetsAt <= now) rateWindows.delete(key);
  }

  if (
    name.length < 2 || name.length > 120 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254 ||
    phone.length > 40 || subject.length > 120 ||
    message.length < 10 || message.length > 5000 || !consent
  ) {
    res.status(400).json({ error: "Check the required fields, message length, and consent before sending." });
    return;
  }

  const smtpHost = process.env["SMTP_HOST"];
  const smtpPort = Number(process.env["SMTP_PORT"] ?? 587);
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const toEmail = process.env["CONTACT_EMAIL"] ?? "britten@zilkakotab.com";
  const fromEmail = process.env["SMTP_FROM_EMAIL"]?.trim() || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535 ||
    !fromEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    logger.error("SMTP environment variables not configured");
    res.status(500).json({ error: "Email service is not configured." });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort !== 465,
    auth: {
      type: "login",
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a2a3a">New Contact Form Submission — Zilka-Kotab PC</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;font-weight:bold;width:100px">Name:</td><td>${safeName}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold">Email:</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
        ${safePhone ? `<tr><td style="padding:8px 0;font-weight:bold">Phone:</td><td>${safePhone}</td></tr>` : ""}
        ${safeSubject ? `<tr><td style="padding:8px 0;font-weight:bold">Subject:</td><td>${safeSubject}</td></tr>` : ""}
      </table>
      <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb"/>
      <h3 style="color:#1a2a3a">Message:</h3>
      <p style="white-space:pre-wrap;color:#374151">${safeMessage}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Zilka-Kotab Website" <${fromEmail}>`,
      to: toEmail,
      replyTo: `"${name.replace(/["\r\n]/g, "")}" <${email}>`,
      subject: subject
        ? `Website Inquiry: ${subject.replace(/[\r\n]/g, " ")}`
        : `Website Inquiry from ${name.replace(/[\r\n]/g, " ")}`,
      html,
    });

    logger.info("Contact form email sent");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : "Unknown SMTP error" }, "Failed to send contact form email");
    res.status(500).json({ error: "Failed to send message. Please try again or email us directly." });
  }
});

export default router;
