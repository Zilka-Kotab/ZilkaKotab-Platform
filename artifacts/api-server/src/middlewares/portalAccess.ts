import type { NextFunction, Request, Response } from "express";
import { db, portalUsersTable, type PortalUser } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";

const BOOTSTRAP_ADMIN_EMAIL = "managezk@zilkakotab.com";

declare global {
  namespace Express {
    interface Request {
      portalUser?: PortalUser;
    }
  }
}

export async function resolvePortalUser(req: Request): Promise<PortalUser | null> {
  if (!req.isAuthenticated() || !req.user.email) return null;
  const email = req.user.email.trim().toLowerCase();
  let [portalUser] = await db
    .select()
    .from(portalUsersTable)
    .where(or(eq(portalUsersTable.authProviderId, req.user.id), eq(portalUsersTable.email, email)))
    .limit(1);

  if (!portalUser && email === BOOTSTRAP_ADMIN_EMAIL) {
    [portalUser] = await db
      .insert(portalUsersTable)
      .values({ authProviderId: req.user.id, email, name: "Portal Administrator", role: "ADMIN", active: true })
      .onConflictDoNothing()
      .returning();
    if (!portalUser) {
      [portalUser] = await db.select().from(portalUsersTable).where(eq(portalUsersTable.email, email)).limit(1);
    }
  }

  if (!portalUser?.active) return null;
  if (portalUser.email !== email) return null;
  if (!portalUser.authProviderId) {
    [portalUser] = await db
      .update(portalUsersTable)
      .set({ authProviderId: req.user.id, updatedAt: new Date() })
      .where(and(eq(portalUsersTable.id, portalUser.id), eq(portalUsersTable.email, email)))
      .returning();
  }
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