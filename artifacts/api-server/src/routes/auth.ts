import { Router, type Request, type Response } from "express";
import * as oidc from "openid-client";
import { clearSession, createSession, getOidcConfig, getSessionId, SESSION_COOKIE, SESSION_TTL, upsertAuthenticatedUser } from "../lib/auth";

const router = Router();
const OIDC_TTL = 10 * 60 * 1000;
const safeReturn = (value: unknown) => typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
const origin = (req: Request) => `${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host}`;
const oidcCookie = (res: Response, name: string, value: string) => res.cookie(name, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: OIDC_TTL });

router.get("/auth/user", (req, res) => res.json({ user: req.isAuthenticated() ? req.user : null }));
router.get("/login", async (req, res) => {
  const config = await getOidcConfig();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const verifier = oidc.randomPKCECodeVerifier();
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: `${origin(req)}/api/callback`,
    scope: "openid email profile offline_access",
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
    nonce,
  });
  oidcCookie(res, "code_verifier", verifier);
  oidcCookie(res, "nonce", nonce);
  oidcCookie(res, "state", state);
  oidcCookie(res, "return_to", safeReturn(req.query.returnTo));
  res.redirect(url.href);
});
router.get("/callback", async (req, res) => {
  const callback = `${origin(req)}/api/callback`;
  const verifier = req.cookies?.code_verifier;
  const state = req.cookies?.state;
  if (!verifier || !state) return res.redirect("/api/login");
  try {
    const currentUrl = new URL(`${callback}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`);
    const tokens = await oidc.authorizationCodeGrant(await getOidcConfig(), currentUrl, {
      pkceCodeVerifier: verifier,
      expectedNonce: req.cookies?.nonce,
      expectedState: state,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) return res.redirect("/api/login");
    const user = await upsertAuthenticatedUser(claims as unknown as Record<string, unknown>);
    const sid = await createSession({
      user,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? Math.floor(Date.now() / 1000) + tokens.expiresIn()! : claims.exp,
    });
    res.cookie(SESSION_COOKIE, sid, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL });
    const returnTo = safeReturn(req.cookies?.return_to);
    for (const name of ["code_verifier", "nonce", "state", "return_to"]) res.clearCookie(name, { path: "/" });
    res.redirect(returnTo);
  } catch {
    res.redirect("/api/login");
  }
});
router.get("/logout", async (req, res) => {
  await clearSession(res, getSessionId(req));
  res.redirect(safeReturn(req.query.returnTo));
});

export default router;