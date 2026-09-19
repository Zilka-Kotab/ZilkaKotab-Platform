import type { NextFunction, Request, Response } from "express";
import * as oidc from "openid-client";
import { clearSession, getOidcConfig, getSession, getSessionId, updateSession, type AuthUser, type SessionData } from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: User;
      isAuthenticated(): this is Request & { user: User };
    }
  }
}

async function refresh(sid: string, session: SessionData): Promise<SessionData | null> {
  if (!session.expires_at || Math.floor(Date.now() / 1000) <= session.expires_at) return session;
  if (!session.refresh_token) return null;
  try {
    const tokens = await oidc.refreshTokenGrant(await getOidcConfig(), session.refresh_token);
    const next = {
      ...session,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? session.refresh_token,
      expires_at: tokens.expiresIn() ? Math.floor(Date.now() / 1000) + tokens.expiresIn()! : session.expires_at,
    };
    await updateSession(sid, next);
    return next;
  } catch {
    return null;
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  req.isAuthenticated = function (this: Request) { return this.user != null; } as Request["isAuthenticated"];
  const sid = getSessionId(req);
  if (!sid) return next();
  const session = await getSession(sid);
  const active = session ? await refresh(sid, session) : null;
  if (!active?.user?.id) {
    await clearSession(res, sid);
    return next();
  }
  req.user = active.user;
  next();
}