import type { NextFunction, Request, Response } from "express";
import { resolveAccess, type AccessContext } from "../lib/internalAccess";

declare global {
  namespace Express {
    interface Request {
      internalAccess?: AccessContext;
    }
  }
}

export async function requireApprovedAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const result = await resolveAccess(req);
  if (result.kind === "unauthenticated") {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (result.kind === "unverified") {
    res.status(403).json({ error: "A verified email address is required." });
    return;
  }
  if (result.kind === "unapproved") {
    res.status(403).json({ error: "This account has not been approved." });
    return;
  }
  req.internalAccess = result.context;
  next();
}

export async function requireAdministrator(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireApprovedAccess(req, res, () => {
    if (req.internalAccess?.access.role !== "admin") {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }
    next();
  });
}