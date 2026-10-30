import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { db, portalUsersTable } from "@workspace/db";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";
import { logger } from "../lib/logger";

const router = Router();
const attempts = new Map<string, { count: number; until: number }>();
const genericResponse = { message: "If this email has approved portal access, you will receive an activation invitation. If you already have an account, sign in or use Forgot password." };

router.get("/auth/user", (req, res) => res.json({ user: req.isAuthenticated() ? req.user : null }));

// Existing approved users can activate their account without a public registration path.
// No records, roles, client assignments, or privileges are created by this endpoint.
router.post("/auth/activate", async (req, res, next) => {
  const now = Date.now();
  const key = req.ip || "unknown";
  if (attempts.size > 1000) for (const [ip, item] of attempts) if (item.until < now) attempts.delete(ip);
  const attempt = attempts.get(key);
  if (attempt && attempt.until > now && attempt.count >= 6) {
    res.status(429).json({ error: "Too many activation requests. Please try again later." });
    return;
  }
  attempts.set(key, { until: attempt && attempt.until > now ? attempt.until : now + 15 * 60_000, count: attempt && attempt.until > now ? attempt.count + 1 : 1 });
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  try {
    const candidates = await db.select({ id: portalUsersTable.id }).from(portalUsersTable)
      .where(and(
        sql`lower(btrim(${portalUsersTable.email})) = ${email}`,
        eq(portalUsersTable.active, true),
        eq(portalUsersTable.status, "ACTIVE"),
      )).limit(2);
    if (candidates.length !== 1) {
      res.status(202).json(genericResponse);
      return;
    }
    // Persist the per-address limit: works across autoscaled instances.
    const sentAt = new Date();
    const [eligible] = await db.update(portalUsersTable).set({ clerkInvitationSentAt: sentAt })
      .where(and(
        eq(portalUsersTable.id, candidates[0].id),
        eq(portalUsersTable.active, true),
        eq(portalUsersTable.status, "ACTIVE"),
        isNull(portalUsersTable.clerkUserId),
        or(isNull(portalUsersTable.clerkInvitationSentAt), lt(portalUsersTable.clerkInvitationSentAt, new Date(now - 60 * 60_000))),
      )).returning({ id: portalUsersTable.id });
    if (eligible) {
      try {
        const existing = await clerkClient.users.getUserList({ emailAddress: [email], limit: 1 });
        if (existing.totalCount === 0) {
          const origin = process.env.NODE_ENV === "production"
            ? process.env.APP_BASE_URL
            : `${req.protocol}://${getClerkProxyHost(req)}`;
          if (!origin) throw new Error("Portal origin is not configured.");
          const redirectUrl = new URL("/sign-up", origin).href;
          await clerkClient.invitations.createInvitation({ emailAddress: email, redirectUrl, expiresInDays: 7, ignoreExisting: true });
        }
      } catch (error) {
        await db.update(portalUsersTable).set({ clerkInvitationSentAt: null })
          .where(and(eq(portalUsersTable.id, eligible.id), eq(portalUsersTable.clerkInvitationSentAt, sentAt)));
        // Deliberately do not disclose whether an address belongs to the firm.
        logger.error({ err: error, portalUserId: eligible.id }, "Clerk activation invitation failed");
      }
    }
    res.status(202).json(genericResponse);
  } catch (error) { next(error); }
});

// Retired Microsoft URLs do not establish sessions or accept old credentials.
router.get("/auth/microsoft/login", (_req, res) => res.redirect("/sign-in"));
router.get("/auth/microsoft/callback", (_req, res) => res.redirect("/sign-in"));

export default router;
