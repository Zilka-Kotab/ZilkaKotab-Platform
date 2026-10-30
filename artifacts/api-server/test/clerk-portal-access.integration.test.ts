import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { db, pool, portalUsersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import type { Request } from "express";
import { resolvePortalUser } from "../src/middlewares/portalAccess";
import { ensureClerkSchema } from "../src/lib/clerk-schema";

test("Clerk identity binding preserves roles, refuses unapproved identities and never rebinds", {
  skip: process.env.RUN_CLERK_DB_TEST !== "1",
}, async () => {
  await ensureClerkSchema();
  const marker = `clerk-test-${randomUUID()}`;
  const records = await db.insert(portalUsersTable).values([
    { email: `${marker}-ACTIVE@example.invalid`, name: marker, role: "ADMIN" as const, status: "ACTIVE" as const, active: true, microsoftTenantId: randomUUID(), microsoftObjectId: randomUUID() },
    { email: `${marker}-pending@example.invalid`, name: marker, role: "CLIENT" as const, status: "PENDING" as const, active: true },
    { email: `${marker}-disabled@example.invalid`, name: marker, role: "CLIENT" as const, status: "DEACTIVATED" as const, active: false },
  ]).returning();
  const [active, pending, disabled] = records;
  function identity(email: string | null, id: string): Request {
    return { isAuthenticated: () => true, user: { id, clerkUserId: id, email, displayName: marker, firstName: null, lastName: null } } as unknown as Request;
  }
  try {
    const id = `user_${randomUUID()}`;
    const first = await resolvePortalUser(identity(active.email.toUpperCase(), id));
    assert.equal(first?.id, active.id);
    assert.equal(first?.role, "ADMIN");
    assert.equal(first?.microsoftObjectId, active.microsoftObjectId);
    assert.equal(first?.clerkUserId, id);
    assert.equal(await resolvePortalUser(identity(active.email, `user_${randomUUID()}`)), null, "Cannot steal an already-bound authorization record");
    assert.equal(await resolvePortalUser(identity(null, id)), null, "Unverified identity cannot bind");
    assert.equal(await resolvePortalUser(identity(pending.email, `user_${randomUUID()}`)), null);
    assert.equal(await resolvePortalUser(identity(disabled.email, `user_${randomUUID()}`)), null);
    assert.equal(await resolvePortalUser(identity(`${marker}-stranger@example.invalid`, `user_${randomUUID()}`)), null);
    await db.update(portalUsersTable).set({ active: false, status: "DEACTIVATED" }).where(eq(portalUsersTable.id, active.id));
    assert.equal(await resolvePortalUser(identity(active.email, id)), null, "Deactivation takes effect on next request");
    const current = await db.select().from(portalUsersTable).where(inArray(portalUsersTable.id, records.map((r) => r.id)));
    assert.equal(current.find((r) => r.id === pending.id)?.clerkUserId, null);
    assert.equal(current.find((r) => r.id === disabled.id)?.clerkUserId, null);
    const duplicates = await db.insert(portalUsersTable).values([
      { email: `${marker}-duplicate@example.invalid`, name: marker, role: "CLIENT" as const, status: "ACTIVE" as const, active: true },
      { email: `${marker}-DUPLICATE@example.invalid`, name: marker, role: "ADMIN" as const, status: "ACTIVE" as const, active: true },
    ]).returning();
    records.push(...duplicates);
    assert.equal(await resolvePortalUser(identity(duplicates[0].email, `user_${randomUUID()}`)), null, "Ambiguous email approvals must never pick an arbitrary role");
  } finally {
    await db.delete(portalUsersTable).where(inArray(portalUsersTable.id, records.map((r) => r.id)));
    await pool.end();
  }
});
