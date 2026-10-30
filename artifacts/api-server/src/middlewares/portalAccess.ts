import type { NextFunction, Request, Response } from "express";
import { db, portalUsersTable, type PortalUser } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      portalUser?: PortalUser;
    }
  }
}

export async function resolvePortalUser(req: Request): Promise<PortalUser | null> {
  if (!req.isAuthenticated() || !req.user.clerkUserId || !req.user.email) return null;
  const email = req.user.email.trim().toLowerCase();
  let [portalUser] = await db
    .select()
    .from(portalUsersTable)
    .where(eq(portalUsersTable.clerkUserId, req.user.clerkUserId))
    .limit(1);

  if (!portalUser) {
    // Clerk normalizes addresses; historical authorization records may not.
    // Do not pick an arbitrary account if legacy records differ only in case.
    const candidates = await db.select({ id: portalUsersTable.id }).from(portalUsersTable)
      .where(and(
        sql`lower(btrim(${portalUsersTable.email})) = ${email}`,
        eq(portalUsersTable.status, "ACTIVE"),
        eq(portalUsersTable.active, true),
      )).limit(2);
    if (candidates.length !== 1) return null;
    [portalUser] = await db
      .update(portalUsersTable)
      .set({
        clerkUserId: req.user.clerkUserId,
        boundAt: new Date(),
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(portalUsersTable.id, candidates[0].id),
        eq(portalUsersTable.status, "ACTIVE"),
        eq(portalUsersTable.active, true),
        isNull(portalUsersTable.clerkUserId),
      ))
      .returning();
    // Concurrent first requests may have bound the same identity already.
    // Re-read by the verified Clerk ID, never by email alone.
    if (!portalUser) {
      [portalUser] = await db.select().from(portalUsersTable)
        .where(eq(portalUsersTable.clerkUserId, req.user.clerkUserId)).limit(1);
    }
  }

  if (!portalUser || portalUser.status !== "ACTIVE" || !portalUser.active) return null;
  await db.update(portalUsersTable).set({ lastLoginAt: new Date() }).where(eq(portalUsersTable.id, portalUser.id));
  return portalUser;
}

export async function requirePortalAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const portalUser = await resolvePortalUser(req);
  if (!portalUser) {
    res.status(403).json({ error: "Access Not Authorized" });
    return;
  }
  req.portalUser = portalUser;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requirePortalAccess(req, res, () => {
    if (req.portalUser?.role !== "ADMIN") {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }
    next();
  });
}