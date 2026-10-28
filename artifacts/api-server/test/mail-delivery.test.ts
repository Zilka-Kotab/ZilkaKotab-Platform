import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverMail, MailDeliveryTimeoutError } from "../src/lib/mail-delivery";

test("mail delivery returns acceptance and closes the transport", async () => {
  let closed = false;
  const result = await deliverMail({
    sendMail: async () => ({ accepted: ["recipient@example.test"] }),
    close: () => { closed = true; },
  }, {});
  assert.equal(result.accepted.length, 1);
  assert.equal(closed, true);
});

test("mail delivery surfaces SMTP rejection and closes the transport", async () => {
  let closed = false;
  await assert.rejects(deliverMail({
    sendMail: async () => { throw new Error("SMTP rejected"); },
    close: () => { closed = true; },
  }, {}), /SMTP rejected/);
  assert.equal(closed, true);
});

test("hung SMTP delivery has a deadline and closes the transport", async () => {
  let closed = false;
  await assert.rejects(deliverMail({
    sendMail: () => new Promise<never>(() => {}),
    close: () => { closed = true; },
  }, {}, 15), MailDeliveryTimeoutError);
  assert.equal(closed, true);
});
