import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { clerkClient } from "@clerk/express";
import { db, pool, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Explicit development-only test. Creates a real temporary Clerk development
// identity/session, never sends mail, and deletes the identity in finally.
test("live Clerk session -> preserved admin -> client restrictions -> approval required", {
  skip: process.env.RUN_CLERK_LIVE_TEST !== "1" || process.env.NODE_ENV === "production",
}, async () => {
  const marker = `clerk-live-${randomUUID()}`;
  const email = `${marker}@example.com`;
  const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  let clerkId: string | undefined;
  let localId: number | undefined;
  try {
    const identity = await clerkClient.users.createUser({
      emailAddress: [email], firstName: "Synthetic", lastName: "Clerk Test",
      skipPasswordRequirement: true,
    });
    clerkId = identity.id;
    const primary = identity.emailAddresses.find((e) => e.id === identity.primaryEmailAddressId);
    assert.equal(primary?.verification?.status, "verified");
    const [local] = await db.insert(portalUsersTable).values({
      email: email.toUpperCase(), name: marker, role: "ADMIN", status: "ACTIVE", active: true,
      microsoftTenantId: randomUUID(), microsoftObjectId: randomUUID(),
    }).returning();
    localId = local.id;
    // Clerk permits backend-created sessions only in development instances.
    const session = await clerkClient.sessions.createSession({ userId: clerkId });
    const token = await clerkClient.sessions.getToken(session.id);
    const sessionCookie = `__session=${token.jwt}`;
    // Node API verification uses the genuine Clerk token. Browser transport
    // remains cookie-only and was separately exercised by the browser tester.
    const request = (path: string, init?: RequestInit) => fetch(`${origin}/api${path}`, {
      ...init, headers: { Authorization: `Bearer ${token.jwt}`, Cookie: sessionCookie, ...init?.headers },
    });
    const access = await request("/portal/access");
    const accessBody = await access.json();
    assert.equal(access.status, 200, JSON.stringify(accessBody));
    assert.equal(accessBody.user.role, "ADMIN");
    assert.equal(accessBody.user.publicId, local.publicId);
    const [bound] = await db.select().from(portalUsersTable).where(eq(portalUsersTable.id, local.id));
    assert.equal(bound.clerkUserId, clerkId);
    assert.equal(bound.microsoftObjectId, local.microsoftObjectId);
    const csrfCookie = access.headers.getSetCookie().find((c) => c.startsWith("zk_csrf="))?.split(";")[0];
    assert.ok(csrfCookie);
    assert.equal((await request("/portal/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    })).status, 403, "Authenticated writes require CSRF");
    assert.equal((await request("/portal/admin/users", {
      method: "POST", headers: {
        Cookie: `${sessionCookie}; ${csrfCookie}`, "Content-Type": "application/json",
        "x-csrf-token": decodeURIComponent(csrfCookie.slice("zk_csrf=".length)),
      }, body: "{}",
    })).status, 400, "Valid CSRF reaches ordinary request-body validation");
    await db.update(portalUsersTable).set({ role: "CLIENT" }).where(eq(portalUsersTable.id, local.id));
    assert.equal((await request("/portal/dashboard")).status, 200);
    assert.equal((await request("/portal/operations")).status, 403);
    assert.equal((await request("/portal/operations/billing")).status, 403);
    assert.equal((await request("/portal/admin/users")).status, 403);
    await db.update(portalUsersTable).set({ status: "PENDING", clerkUserId: null }).where(eq(portalUsersTable.id, local.id));
    assert.equal((await request("/portal/access")).status, 403);
    const [pending] = await db.select().from(portalUsersTable).where(eq(portalUsersTable.id, local.id));
    assert.equal(pending.clerkUserId, null);
    await db.delete(portalUsersTable).where(eq(portalUsersTable.id, local.id));
    localId = undefined;
    assert.equal((await request("/portal/access")).status, 403, "Identity alone never creates authorization");
    assert.equal((await db.select().from(portalUsersTable).where(eq(portalUsersTable.clerkUserId, clerkId))).length, 0);
  } finally {
    if (localId) await db.delete(portalUsersTable).where(eq(portalUsersTable.id, localId));
    if (clerkId) await clerkClient.users.deleteUser(clerkId);
    await pool.end();
  }
});
