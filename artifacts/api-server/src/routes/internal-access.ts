import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, internalAccessUsersTable } from "@workspace/db";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  normalizeEmail,
  resolveAccess,
} from "../lib/internalAccess";
import { requireAdministrator } from "../middlewares/internalAccess";

const router: IRouter = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serializeAccessUser(user: typeof internalAccessUsersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    approved: user.approved,
    activated: Boolean(user.clerkUserId),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

router.get("/internal/access", async (req, res): Promise<void> => {
  const result = await resolveAccess(req);
  if (result.kind === "unauthenticated") {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (result.kind === "unverified") {
    res.status(403).json({ status: "unverified", approved: false, role: null });
    return;
  }
  if (result.kind === "unapproved") {
    res.json({
      status: "pending",
      approved: false,
      role: null,
      email: result.email,
    });
    return;
  }
  res.json({
    status: "approved",
    approved: true,
    role: result.context.access.role,
    email: result.context.email,
  });
});

router.get(
  "/internal/users",
  requireAdministrator,
  async (_req, res): Promise<void> => {
    const users = await db
      .select()
      .from(internalAccessUsersTable)
      .orderBy(asc(internalAccessUsersTable.email));
    res.json({ users: users.map(serializeAccessUser) });
  },
);

router.post(
  "/internal/users",
  requireAdministrator,
  async (req, res): Promise<void> => {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
    const email = normalizeEmail(rawEmail);
    const role = req.body?.role === "admin" ? "admin" : "user";
    if (!EMAIL_PATTERN.test(email)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    const [existing] = await db
      .select()
      .from(internalAccessUsersTable)
      .where(eq(internalAccessUsersTable.email, email))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "That email already has an access record." });
      return;
    }

    const [created] = await db
      .insert(internalAccessUsersTable)
      .values({
        email,
        role: email === BOOTSTRAP_ADMIN_EMAIL ? "admin" : role,
        approved: true,
        approvedById: req.internalAccess!.access.id,
      })
      .returning();
    req.log.info({ accessUserId: created.id, role: created.role }, "Internal access granted");
    res.status(201).json({ user: serializeAccessUser(created) });
  },
);

router.patch(
  "/internal/users/:id",
  requireAdministrator,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = Number.parseInt(rawId, 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid access record." });
      return;
    }

    const [target] = await db
      .select()
      .from(internalAccessUsersTable)
      .where(eq(internalAccessUsersTable.id, id))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Access record not found." });
      return;
    }
    if (target.email === BOOTSTRAP_ADMIN_EMAIL) {
      res.status(400).json({ error: "The initial administrator cannot be changed." });
      return;
    }

    const approved = typeof req.body?.approved === "boolean" ? req.body.approved : target.approved;
    const role =
      req.body?.role === "admin" || req.body?.role === "user"
        ? req.body.role
        : target.role;
    if (target.id === req.internalAccess!.access.id && (!approved || role !== "admin")) {
      res.status(400).json({ error: "You cannot revoke your own administrator access." });
      return;
    }

    const [updated] = await db
      .update(internalAccessUsersTable)
      .set({
        approved,
        role,
        approvedById: approved ? req.internalAccess!.access.id : target.approvedById,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(internalAccessUsersTable.id, id),
          eq(internalAccessUsersTable.email, target.email),
        ),
      )
      .returning();
    req.log.info(
      { accessUserId: updated.id, approved: updated.approved, role: updated.role },
      "Internal access updated",
    );
    res.json({ user: serializeAccessUser(updated) });
  },
);

export default router;