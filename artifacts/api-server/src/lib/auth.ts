import crypto from "crypto";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import * as client from "openid-client";

export type AuthUser = {
  id: string;
  tenantId: string;
  objectId: string;
  email: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
};
export type SessionData = {
  user: AuthUser;
  createdAt: number;
  lastSeenAt: number;
};

export const SESSION_COOKIE = "zk_session";
export const CSRF_COOKIE = "zk_csrf";
export const SESSION_IDLE_TTL = 8 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL = 7 * 24 * 60 * 60 * 1000;
let oidcConfig: client.Configuration | null = null;

function requiredEnv(name: "AZURE_CLIENT_ID" | "AZURE_CLIENT_SECRET" | "AZURE_TENANT_ID") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export async function getMicrosoftOidcConfig() {
  if (!oidcConfig) {
    const clientId = requiredEnv("AZURE_CLIENT_ID");
    const clientSecret = requiredEnv("AZURE_CLIENT_SECRET");
    const tenant = requiredEnv("AZURE_TENANT_ID");
    if (tenant !== "organizations") throw new Error("AZURE_TENANT_ID must be set to organizations.");
    oidcConfig = await client.discovery(
      new URL(`https://login.microsoftonline.com/${tenant}/v2.0`),
      clientId,
      { client_secret: clientSecret, id_token_signed_response_alg: "RS256" },
      client.ClientSecretPost(clientSecret),
    );
  }
  return oidcConfig;
}

export async function createSession(data: SessionData) {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_IDLE_TTL),
  });
  return sid;
}
export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid)).limit(1);
  const session = row?.sess as unknown as SessionData | undefined;
  const now = Date.now();
  if (!row || !session?.createdAt || row.expire.getTime() <= now || session.createdAt + SESSION_ABSOLUTE_TTL <= now) {
    if (row) await deleteSession(sid);
    return null;
  }
  const active = { ...session, lastSeenAt: now };
  await db.update(sessionsTable).set({
    sess: active as unknown as Record<string, unknown>,
    expire: new Date(Math.min(now + SESSION_IDLE_TTL, session.createdAt + SESSION_ABSOLUTE_TTL)),
  }).where(eq(sessionsTable.sid, sid));
  return active;
}
export async function deleteSession(sid: string) {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}
export async function clearSession(res: Response, sid?: string) {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
}
export function getSessionId(req: Request) {
  return req.cookies?.[SESSION_COOKIE] as string | undefined;
}
export function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}
export function authUserFromMicrosoftClaims(claims: Record<string, unknown>): AuthUser {
  const tenantId = typeof claims.tid === "string" ? claims.tid : "";
  const objectId = typeof claims.oid === "string" ? claims.oid : "";
  const issuer = typeof claims.iss === "string" ? claims.iss : "";
  const clientId = requiredEnv("AZURE_CLIENT_ID");
  const audience = claims.aud;
  const expiration = typeof claims.exp === "number" ? claims.exp : 0;
  const expectedIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  if (!tenantId || !objectId || tenantId === "consumers") throw new Error("A Microsoft organizational account is required.");
  if (issuer !== expectedIssuer) throw new Error("Invalid Microsoft token issuer.");
  if (!(audience === clientId || (Array.isArray(audience) && audience.includes(clientId)))) throw new Error("Invalid Microsoft token audience.");
  if (expiration <= Math.floor(Date.now() / 1000)) throw new Error("Expired Microsoft identity token.");
  const emailClaim = typeof claims.preferred_username === "string" ? claims.preferred_username : claims.email;
  const email = typeof emailClaim === "string" ? emailClaim.trim().toLowerCase() : null;
  if (!email) throw new Error("Microsoft did not provide an organizational email address.");
  const displayName = typeof claims.name === "string" ? claims.name.trim() : null;
  const parts = displayName?.split(/\s+/) ?? [];
  return {
    id: `${tenantId}:${objectId}`,
    tenantId,
    objectId,
    email,
    displayName,
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}