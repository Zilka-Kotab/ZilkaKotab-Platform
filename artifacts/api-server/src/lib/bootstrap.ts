import { and, count, eq } from "drizzle-orm";
import { db, portalUsersTable, toolsTable } from "@workspace/db";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates the configured first-admin authorization record once.
 *
 * This does not authenticate anyone and is not an access bypass. The normal
 * Microsoft callback still has to validate the user's identity, then bind it
 * to this Pending record by email before portal access is granted.
 */
export async function ensureInitialAdminAuthorization() {
  const configuredEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredEmail) return;
  if (!EMAIL.test(configuredEmail)) throw new Error("INITIAL_ADMIN_EMAIL must be a valid email address.");

  const [existing] = await db
    .select({ id: portalUsersTable.id })
    .from(portalUsersTable)
    .where(eq(portalUsersTable.email, configuredEmail))
    .limit(1);
  if (existing) return;

  const [{ adminCount }] = await db
    .select({ adminCount: count() })
    .from(portalUsersTable)
    .where(and(eq(portalUsersTable.role, "ADMIN"), eq(portalUsersTable.status, "ACTIVE")));
  if (adminCount > 0) return;

  await db.insert(portalUsersTable).values({
    email: configuredEmail,
    name: "Initial Administrator",
    role: "ADMIN",
    status: "PENDING",
    active: false,
  }).onConflictDoNothing({ target: portalUsersTable.email });
}

/**
 * Ensures the first-party Patent Monitor is present without changing an
 * administrator's active/inactive decision on later startups.
 */
export async function ensurePatentMonitorTool() {
  await db.insert(toolsTable).values({
    name: "Patent Infringement Monitor",
    slug: "patent-infringement-monitor",
    description: "Monitor patent claims against potentially relevant products and technologies, organize evidence, and triage findings for attorney review.",
    active: true,
  }).onConflictDoNothing({ target: toolsTable.slug });
}