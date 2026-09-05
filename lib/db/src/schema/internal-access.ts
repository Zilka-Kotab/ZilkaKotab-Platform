import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const internalAccessRoleEnum = pgEnum("internal_access_role", ["admin", "user"]);

export const internalAccessUsersTable = pgTable(
  "internal_access_users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    email: text("email").notNull(),
    role: internalAccessRoleEnum("role").notNull().default("user"),
    approved: boolean("approved").notNull().default(true),
    approvedById: integer("approved_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("internal_access_users_email_unique").on(table.email),
    uniqueIndex("internal_access_users_clerk_user_id_unique").on(table.clerkUserId),
    index("internal_access_users_approved_idx").on(table.approved),
  ],
);

export const insertInternalAccessUserSchema = createInsertSchema(
  internalAccessUsersTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertInternalAccessUser = z.infer<typeof insertInternalAccessUserSchema>;
export type InternalAccessUser = typeof internalAccessUsersTable.$inferSelect;