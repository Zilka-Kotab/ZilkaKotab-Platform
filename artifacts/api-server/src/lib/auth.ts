import crypto from "crypto";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import * as client from "openid-client";

export type AuthUser = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};
export type SessionData = {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
};

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";
let oidcConfig: client.Configuration | null = null;

export async function getOidcConfig() {
  oidcConfig ??= await client.discovery(new URL(ISSUER_URL), process.env.REPL_ID!);
  return oidcConfig;
}
export async function createSession(data: SessionData) {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({ sid, sess: data as unknown as Record<string, unknown>, expire: new Date(Date.now() + SESSION_TTL) });
  return sid;
}
export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid)).limit(1);
  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }
  return row.sess as unknown as SessionData;
}
export async function updateSession(sid: string, data: SessionData) {
  await db.update(sessionsTable).set({ sess: data as unknown as Record<string, unknown>, expire: new Date(Date.now() + SESSION_TTL) }).where(eq(sessionsTable.sid, sid));
}
export async function deleteSession(sid: string) {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}
export async function clearSession(res: Response, sid?: string) {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
export function getSessionId(req: Request) {
  return req.cookies?.[SESSION_COOKIE] as string | undefined;
}
export async function upsertAuthenticatedUser(claims: Record<string, unknown>): Promise<AuthUser> {
  const data = {
    id: String(claims.sub),
    email: typeof claims.email === "string" ? claims.email.toLowerCase() : null,
    firstName: typeof claims.first_name === "string" ? claims.first_name : null,
    lastName: typeof claims.last_name === "string" ? claims.last_name : null,
    profileImageUrl: typeof (claims.profile_image_url ?? claims.picture) === "string" ? String(claims.profile_image_url ?? claims.picture) : null,
  };
  const [user] = await db.insert(usersTable).values(data).onConflictDoUpdate({ target: usersTable.id, set: { ...data, updatedAt: new Date() } }).returning();
  return user;
}