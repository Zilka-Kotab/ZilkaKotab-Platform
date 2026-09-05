import type { Request } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { db, internalAccessUsersTable, type InternalAccessUser } from "@workspace/db";
import { eq } from "drizzle-orm";

export const BOOTSTRAP_ADMIN_EMAIL = "managezk@zilkakotab.com";

export type AccessContext = {
  userId: string;
  email: string;
  access: InternalAccessUser;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function getVerifiedEmail(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (address) =>
      address.id === user.primaryEmailAddressId &&
      address.verification?.status === "verified",
  );
  const verified = primary ?? user.emailAddresses.find(
    (address) => address.verification?.status === "verified",
  );
  return verified ? normalizeEmail(verified.emailAddress) : null;
}

export async function resolveAccess(req: Request): Promise<
  | { kind: "unauthenticated" }
  | { kind: "unverified" }
  | { kind: "unapproved"; userId: string; email: string }
  | { kind: "approved"; context: AccessContext }
> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return { kind: "unauthenticated" };

  const email = await getVerifiedEmail(userId);
  if (!email) return { kind: "unverified" };

  const isBootstrapAdmin = email === BOOTSTRAP_ADMIN_EMAIL;
  const [existing] = await db
    .select()
    .from(internalAccessUsersTable)
    .where(eq(internalAccessUsersTable.email, email))
    .limit(1);

  if (!existing && !isBootstrapAdmin) {
    return { kind: "unapproved", userId, email };
  }

  const desiredRole = isBootstrapAdmin ? "admin" : existing!.role;
  const desiredApproval = isBootstrapAdmin ? true : existing!.approved;
  const [access] = await db
    .insert(internalAccessUsersTable)
    .values({
      email,
      clerkUserId: userId,
      role: desiredRole,
      approved: desiredApproval,
    })
    .onConflictDoUpdate({
      target: internalAccessUsersTable.email,
      set: {
        clerkUserId: userId,
        ...(isBootstrapAdmin ? { role: "admin" as const, approved: true } : {}),
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!access.approved) return { kind: "unapproved", userId, email };
  return { kind: "approved", context: { userId, email, access } };
}