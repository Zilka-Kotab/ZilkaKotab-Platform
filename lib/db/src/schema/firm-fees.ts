import { pgTable, serial, uuid, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { portalUsersTable } from "./portal";

export interface FeeEntry {
  id: string; code: string; jurisdiction: string; subjectMatter: string; itemShort: string;
  description: string; rateType: "FLAT" | "HOURLY" | "APPROVAL" | "ADJUSTMENT";
  rateText: string; amountCents: number | null;
}
export interface WorkflowBilling {
  scheduleId: string | null; entryId: string | null; code: string; jurisdiction: string;
  subjectMatter: string; itemShort: string; description: string; details: string; notes: string;
  amountCents: number; ownerId: number; ownerShareBasisPoints: number; ownerFixedCents: number | null;
  assigneeId: number | null; assigneeShareBasisPoints: number;
}
export interface FeeAllocation { userId: number; name: string; role: "OWNER" | "ASSIGNEE"; amountCents: number }
export const firmFeeSchedulesTable = pgTable("firm_fee_schedules", {
  id: serial("id").primaryKey(),
  publicId: uuid("public_id").notNull().unique("firm_fee_schedules_public_id_key").defaultRandom(),
  client: text("client").notNull(),
  name: text("name").notNull(),
  sourceFileName: text("source_file_name").notNull().default(""),
  entries: jsonb("entries").$type<FeeEntry[]>().notNull(),
  createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
