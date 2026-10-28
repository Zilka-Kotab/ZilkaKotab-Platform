import { ReplitConnectors } from "@replit/connectors-sdk";

export class MailDeliveryTimeoutError extends Error {
  readonly code = "DELIVERY_TIMEOUT";
  constructor() {
    super("Microsoft 365 mail acceptance deadline exceeded");
    this.name = "MailDeliveryTimeoutError";
  }
}

export class MailDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly providerStatus?: number,
    readonly providerRequestId?: string,
  ) {
    // Provider bodies can contain mailbox information. Keep errors/logs metadata-only.
    super("Microsoft 365 did not accept the contact message");
    this.name = "MailDeliveryError";
  }
}

export type ContactMail = {
  to: string;
  replyTo: { name: string; address: string };
  subject: string;
  html: string;
};

type GraphRequest = (path: string, init: RequestInit) => Promise<Response>;

export async function deliverMail(
  message: ContactMail,
  options: { request?: GraphRequest; deadlineMs?: number } = {},
): Promise<{ provider: "microsoft-graph"; status: number; providerRequestId?: string }> {
  const connectionId = process.env["CONTACT_OUTLOOK_CONNECTION_ID"];
  if (!options.request && !connectionId) throw new MailDeliveryError("OUTLOOK_NOT_CONFIGURED");
  // Pin the authorized sender, rather than silently switching to a different
  // account if another Outlook connection is added later. The SDK manages auth.
  const request = options.request ?? new ReplitConnectors().createProxyFetch("outlook", { connectionId });
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await request("/v1.0/me/sendMail", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              subject: message.subject,
              body: { contentType: "HTML", content: message.html },
              toRecipients: [{ emailAddress: { address: message.to } }],
              replyTo: [{ emailAddress: message.replyTo }],
            },
            saveToSentItems: true,
          }),
        });
        const providerRequestId = response.headers.get("request-id")?.slice(0, 128);
        // Graph sendMail returns an empty 202 (some documented implementations
        // use 204). Do not require JSON or treat arbitrary 2xx responses as sent.
        if (response.status !== 202 && response.status !== 204) {
          const body = await response.json().catch(() => null) as { error?: { code?: unknown } } | null;
          const code = body?.error?.code;
          const safeCode = typeof code === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(code)
            ? code : "UNEXPECTED_MAIL_RESPONSE";
          throw new MailDeliveryError(safeCode, response.status, providerRequestId);
        }
        return { provider: "microsoft-graph" as const, status: response.status, providerRequestId };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new MailDeliveryTimeoutError());
        }, options.deadlineMs ?? 25_000);
      }),
    ]);
  } catch (error) {
    if (controller.signal.aborted) throw new MailDeliveryTimeoutError();
    if (error instanceof MailDeliveryError) throw error;
    throw new MailDeliveryError("OUTLOOK_CONNECTION_FAILED");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
