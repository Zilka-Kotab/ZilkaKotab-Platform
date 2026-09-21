import type { NextFunction, Request, Response } from "express";
import { clearSession, getSession, getSessionId, type AuthUser } from "../lib/auth";

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
  const sid = getSessionId(req);
  if (!sid) return next();
  const active = await getSession(sid);
  if (!active?.user?.tenantId || !active.user.objectId) {
    await clearSession(res, sid);
    return next();
  }
  req.user = active.user;
  next();
}