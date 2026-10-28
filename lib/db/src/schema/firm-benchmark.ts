import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const firmBenchmarkApplicationsTable = pgTable("firm_benchmark_applications", {
  applicationNumber: text("application_number").primaryKey(),
  record: jsonb("record").notNull(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
});
export const firmBenchmarkRefreshTable = pgTable("firm_benchmark_refresh", {
  id: integer("id").primaryKey(),
  state: text("state").notNull().default("idle"),
  applicationCount: integer("application_count").notNull().default(0),
  completedCustomerNumbers: integer("completed_customer_numbers").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
});
export const insertFirmBenchmarkApplicationSchema = createInsertSchema(firmBenchmarkApplicationsTable);
export type InsertFirmBenchmarkApplication = z.infer<typeof insertFirmBenchmarkApplicationSchema>;
export const insertFirmBenchmarkRefreshSchema = createInsertSchema(firmBenchmarkRefreshTable);
export type InsertFirmBenchmarkRefresh = z.infer<typeof insertFirmBenchmarkRefreshSchema>;
