import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { CSRF_COOKIE } from "../lib/auth";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const PUBLIC_FORM_PATHS = new Set([
  "/api/contact",
  "/api/public-tools/inquiry",
]);

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || PUBLIC_FORM_PATHS.has(req.path) || !req.isAuthenticated()) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get("x-csrf-token");
  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    res.status(403).json({ error: "Invalid CSRF token." });
    return;
  }
  next();
}