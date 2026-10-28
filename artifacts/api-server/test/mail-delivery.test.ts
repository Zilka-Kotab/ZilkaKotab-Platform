import assert from "node:assert/strict";
import { test } from "node:test";
import { deliverMail, MailDeliveryError, MailDeliveryTimeoutError, type ContactMail } from "../src/lib/mail-delivery";

const message: ContactMail = {
  to: "recipient@example.test",
  replyTo: { name: "Website visitor", address: "visitor@example.test" },
  subject: "Website Inquiry",
  html: "<p>A contact message</p>",
};

test("Microsoft Graph gets the recipient, HTML and visitor reply-to; empty 202 is acceptance", async () => {
  const result = await deliverMail(message, { request: async (path, init) => {
    assert.equal(path, "/v1.0/me/sendMail");
    assert.equal(init.method, "POST");
    const body = JSON.parse(String(init.body));
    assert.equal(body.message.toRecipients[0].emailAddress.address, message.to);
    assert.deepEqual(body.message.replyTo[0].emailAddress, message.replyTo);
    assert.deepEqual(body.message.body, { contentType: "HTML", content: message.html });
    assert.equal(body.message.subject, message.subject);
    assert.equal(body.message.from, undefined);
    assert.equal(body.saveToSentItems, true);
    return new Response(null, { status: 202, headers: { "request-id": "trace-123" } });
  } });
  assert.deepEqual(result, { provider: "microsoft-graph", status: 202, providerRequestId: "trace-123" });
});

test("documented empty 204 is also accepted", async () => {
  const result = await deliverMail(message, { request: async () => new Response(null, { status: 204 }) });
  assert.equal(result.status, 204);
});

for (const status of [200, 401, 403, 429, 500, 502]) {
  test(`Graph ${status} cannot become a false success`, async () => {
    await assert.rejects(deliverMail(message, {
      request: async () => new Response(JSON.stringify({
        error: { code: "ErrorAccessDenied", message: "Private provider details" },
      }), { status }),
    }), (error: unknown) => {
      assert.ok(error instanceof MailDeliveryError);
      assert.equal(error.providerStatus, status);
      assert.equal(error.code, "ErrorAccessDenied");
      assert.ok(!error.message.includes("Private provider details"));
      return true;
    });
  });
}

test("non-JSON proxy failures are explicit errors", async () => {
  await assert.rejects(deliverMail(message, {
    request: async () => new Response("<html>Gateway error</html>", { status: 502 }),
  }), (error: unknown) => error instanceof MailDeliveryError && error.code === "UNEXPECTED_MAIL_RESPONSE");
});

test("network failure is explicit without leaking request credentials", async () => {
  await assert.rejects(deliverMail(message, {
    request: async () => { throw new Error("Private request metadata"); },
  }), (error: unknown) => error instanceof MailDeliveryError && error.code === "OUTLOOK_CONNECTION_FAILED"
    && !error.message.includes("Private request metadata"));
});

test("hung Graph delivery aborts its request and has a finite deadline", async () => {
  let signal: AbortSignal | undefined;
  await assert.rejects(deliverMail(message, {
    request: async (_path, init) => {
      signal = init.signal ?? undefined;
      return new Promise<never>(() => {});
    },
    deadlineMs: 15,
  }), MailDeliveryTimeoutError);
  assert.equal(signal?.aborted, true);
});
