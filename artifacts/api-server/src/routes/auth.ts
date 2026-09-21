import { Router, type Request, type Response } from "express";
import * as oidc from "openid-client";
import {
  authUserFromMicrosoftClaims,
  clearSession,
  createCsrfToken,
  createSession,
  CSRF_COOKIE,
  getMicrosoftOidcConfig,
  getSessionId,
  SESSION_ABSOLUTE_TTL,
  SESSION_COOKIE,
} from "../lib/auth";

const router = Router();
const OIDC_TTL = 10 * 60 * 1000;
const AUTH_RATE_WINDOW = 15 * 60 * 1000;
const AUTH_RATE_LIMIT = 20;
const authAttempts = new Map<string, { count: number; resetsAt: number }>();
const safeReturn = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/portal";
const appBaseUrl = () => {
  const value = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  if (!value) throw new Error("APP_BASE_URL is required.");
  return value;
};
const callbackUrl = () => `${appBaseUrl()}/api/auth/microsoft/callback`;
const secureCookie = process.env.NODE_ENV === "production";
const oidcCookie = (res: Response, name: string, value: string) =>
  res.cookie(name, value, { httpOnly: true, secure: secureCookie, sameSite: "lax", path: "/", maxAge: OIDC_TTL });
const clearOidcCookies = (res: Response) => {
  for (const name of ["microsoft_code_verifier", "microsoft_nonce", "microsoft_state", "microsoft_return_to"]) {
    res.clearCookie(name, { path: "/" });
  }
};
const authRateLimit = (req: Request, res: Response, next: () => void) => {
  const key = req.ip || "unknown";
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetsAt <= now) {
    authAttempts.set(key, { count: 1, resetsAt: now + AUTH_RATE_WINDOW });
    next();
    return;
  }
  current.count += 1;
  if (current.count > AUTH_RATE_LIMIT) {
    res.setHeader("Retry-After", Math.ceil((current.resetsAt - now) / 1000));
    res.status(429).json({ error: "Too many authentication attempts. Please try again later." });
    return;
  }
  next();
};

router.get("/auth/user", (req, res) => res.json({ user: req.isAuthenticated() ? req.user : null }));

router.get("/auth/microsoft/login", authRateLimit, async (req, res, next) => {
  try {
    const config = await getMicrosoftOidcConfig();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const verifier = oidc.randomPKCECodeVerifier();
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl(),
      scope: "openid email profile",
      response_type: "code",
      response_mode: "query",
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    });
    oidcCookie(res, "microsoft_code_verifier", verifier);
    oidcCookie(res, "microsoft_nonce", nonce);
    oidcCookie(res, "microsoft_state", state);
    oidcCookie(res, "microsoft_return_to", safeReturn(req.query.returnTo));
    res.redirect(url.href);
  } catch (error) {
    next(error);
  }
});

router.get("/auth/microsoft/callback", authRateLimit, async (req, res) => {
  const verifier = req.cookies?.microsoft_code_verifier;
  const state = req.cookies?.microsoft_state;
  const nonce = req.cookies?.microsoft_nonce;
  if (!verifier || !state || !nonce) return void res.redirect("/sign-in?error=invalid_auth_request");
  try {
    const currentUrl = new URL(`${callbackUrl()}?${new URL(req.url, "http://localhost").searchParams}`);
    const tokens = await oidc.authorizationCodeGrant(await getMicrosoftOidcConfig(), currentUrl, {
      pkceCodeVerifier: verifier,
      expectedNonce: nonce,
      expectedState: state,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) throw new Error("Microsoft did not return identity claims.");
    const user = authUserFromMicrosoftClaims(claims as unknown as Record<string, unknown>);
    const now = Date.now();
    const sid = await createSession({ user, createdAt: now, lastSeenAt: now });
    const csrfToken = createCsrfToken();
    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_ABSOLUTE_TTL,
    });
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure: secureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_ABSOLUTE_TTL,
    });
    const returnTo = safeReturn(req.cookies?.microsoft_return_to);
    clearOidcCookies(res);
    res.redirect(returnTo);
  } catch {
    clearOidcCookies(res);
    res.redirect("/sign-in?error=microsoft_auth_failed");
  }
});

router.get("/auth/logout", async (req, res) => {
  await clearSession(res, getSessionId(req));
  res.redirect(safeReturn(req.query.returnTo));
});

export default router;