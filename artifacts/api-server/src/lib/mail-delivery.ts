import type { SendMailOptions } from "nodemailer";

export class MailDeliveryTimeoutError extends Error {
  readonly code = "DELIVERY_TIMEOUT";
  constructor() {
    super("SMTP delivery deadline exceeded");
    this.name = "MailDeliveryTimeoutError";
  }
}

// Use a cancellable (pooled) transport: close() stops pending work when the
// deadline expires rather than allowing a timed-out request to send later.
export async function deliverMail<T>(
  transport: { sendMail(options: SendMailOptions): Promise<T>; close(): void },
  message: SendMailOptions,
  deadlineMs = 25_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      transport.sendMail(message),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new MailDeliveryTimeoutError()), deadlineMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    transport.close();
  }
}
