import type { NextFunction, Request, Response } from "express";
import { db, portalUsersTable, type PortalUser } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

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
    .where(and(
      eq(portalUsersTable.microsoftTenantId, req.user.tenantId),
      eq(portalUsersTable.microsoftObjectId, req.user.objectId),
    ))
    .limit(1);

  if (!portalUser) {
    [portalUser] = await db
      .update(portalUsersTable)
      .set({
        microsoftTenantId: req.user.tenantId,
        microsoftObjectId: req.user.objectId,
        boundAt: new Date(),
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(portalUsersTable.email, email),
        eq(portalUsersTable.status, "ACTIVE"),
        eq(portalUsersTable.active, true),
        isNull(portalUsersTable.microsoftTenantId),
        isNull(portalUsersTable.microsoftObjectId),
      ))
      .returning();
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