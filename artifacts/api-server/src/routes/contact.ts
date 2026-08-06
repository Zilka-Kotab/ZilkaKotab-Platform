import { Router } from "express";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger";

const router = Router();

router.post("/contact", async (req, res) => {
  const { name, email, phone, subject, message } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    subject?: string;
    message?: string;
  };

  if (!name || !email || !message) {
    res.status(400).json({ error: "Name, email, and message are required." });
    return;
  }

  const smtpHost = process.env["SMTP_HOST"];
  const smtpPort = Number(process.env["SMTP_PORT"] ?? 587);
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const toEmail = process.env["CONTACT_EMAIL"] ?? "britten@zilkakotab.com";

  if (!smtpHost || !smtpUser || !smtpPass) {
    logger.error("SMTP environment variables not configured");
    res.status(500).json({ error: "Email service is not configured." });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,   // true only for port 465 (SSL); 587 uses STARTTLS
    requireTLS: smtpPort !== 465, // enforce STARTTLS upgrade on port 587
    auth: {
      type: "login",
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      // Allow self-signed certs on on-premise Exchange servers
      rejectUnauthorized: false,
    },
  });

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1a2a3a">New Contact Form Submission — Zilka-Kotab PC</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;font-weight:bold;width:100px">Name:</td><td>${name}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold">Email:</td><td><a href="mailto:${email}">${email}</a></td></tr>
        ${phone ? `<tr><td style="padding:8px 0;font-weight:bold">Phone:</td><td>${phone}</td></tr>` : ""}
        ${subject ? `<tr><td style="padding:8px 0;font-weight:bold">Subject:</td><td>${subject}</td></tr>` : ""}
      </table>
      <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb"/>
      <h3 style="color:#1a2a3a">Message:</h3>
      <p style="white-space:pre-wrap;color:#374151">${message}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Zilka-Kotab Website" <${smtpUser}>`,
      to: toEmail,
      replyTo: `"${name}" <${email}>`,
      subject: subject
        ? `Website Inquiry: ${subject}`
        : `Website Inquiry from ${name}`,
      html,
    });

    logger.info({ name, email }, "Contact form email sent");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to send contact form email");
    res.status(500).json({ error: "Failed to send message. Please try again or email us directly." });
  }
});

export default router;
