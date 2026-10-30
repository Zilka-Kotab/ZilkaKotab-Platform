import type { NextFunction, Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { db, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createCsrfToken, CSRF_COOKIE, type AuthUser } from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: User;
      isAuthenticated(): this is Request & { user: User };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  req.isAuthenticated = function (this: Request) { return this.user != null; } as Request["isAuthenticated"];
  try {
    // Only Clerk's cryptographically verified session establishes identity.
    // Old Microsoft session cookies are intentionally no longer accepted.
    const { userId } = getAuth(req);
    if (!userId) return next();
    const [bound] = await db.select().from(portalUsersTable)
      .where(eq(portalUsersTable.clerkUserId, userId)).limit(1);
    let email: string | null = bound?.email ?? null;
    let displayName: string | null = bound?.name ?? null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    if (!bound) {
      const identity = await clerkClient.users.getUser(userId);
      const primary = identity.emailAddresses.find((e) => e.id === identity.primaryEmailAddressId);
      // Never bind on browser-supplied, unverified or secondary email.
      email = primary?.verification?.status === "verified" ? primary.emailAddress.trim().toLowerCase() : null;
      firstName = identity.firstName;
      lastName = identity.lastName;
      displayName = [firstName, lastName].filter(Boolean).join(" ") || email;
    }
    req.user = { id: userId, clerkUserId: userId, email, displayName, firstName, lastName };
    if (!req.cookies?.[CSRF_COOKIE]) {
      res.cookie(CSRF_COOKIE, createCsrfToken(), {
        httpOnly: false, sameSite: "lax", secure: req.secure, path: "/",
      });
    }
    next();
  } catch (error) { next(error); }
}
