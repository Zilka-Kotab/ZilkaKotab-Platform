import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { portalUsersTable } from "./portal";

export type AppCollMatterRecord = Record<string, string>;

export const internalWorkflowMattersTable = pgTable(
  "internal_workflow_matters",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    appCollMatterId: varchar("appcoll_matter_id", { length: 120 }).notNull(),
    docketId: text("docket_id").notNull().default(""),
    title: text("title").notNull().default(""),
    matterType: text("matter_type").notNull().default(""),
    status: text("status").notNull().default(""),
    responsibleAttorney: text("responsible_attorney").notNull().default(""),
    paralegal: text("paralegal").notNull().default(""),
    client: text("client").notNull().default(""),
    clientReference: text("client_reference").notNull().default(""),
    applicationNumber: text("application_number").notNull().default(""),
    patentNumber: text("patent_number").notNull().default(""),
    ptoStatus: text("pto_status").notNull().default(""),
    nextExternalTask: text("next_external_task").notNull().default(""),
    nextExternalDueDate: date("next_external_due_date", { mode: "string" }),
    nextInternalTask: text("next_internal_task").notNull().default(""),
    nextInternalDueDate: date("next_internal_due_date", { mode: "string" }),
    openExternalTaskCount: integer("open_external_task_count").notNull().default(0),
    openInternalTaskCount: integer("open_internal_task_count").notNull().default(0),
    rawRecord: jsonb("raw_record").$type<AppCollMatterRecord>().notNull().default({}),
    lastImportedAt: timestamp("last_imported_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("internal_workflow_matters_public_id_unique").on(table.publicId),
    uniqueIndex("internal_workflow_matters_appcoll_id_unique").on(table.appCollMatterId),
    index("internal_workflow_matters_docket_idx").on(table.docketId),
    index("internal_workflow_matters_client_idx").on(table.client),
  ],
);

export const internalWorkflowImportsTable = pgTable(
  "internal_workflow_imports",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    fileName: text("file_name").notNull(),
    fileHash: varchar("file_hash", { length: 64 }).notNull(),
    source: varchar("source", { length: 20 }).notNull().default("MANUAL"),
    status: varchar("status", { length: 20 }).notNull().default("REVIEW"),
    previewData: jsonb("preview_data").$type<AppCollMatterRecord[] | null>(),
    summary: jsonb("summary").$type<Record<string, number>>().notNull().default({}),
    exceptions: jsonb("exceptions").$type<Array<{ row: number; field: string; message: string }>>().notNull().default([]),
    createdBy: integer("created_by").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("internal_workflow_imports_public_id_unique").on(table.publicId),
    index("internal_workflow_imports_created_idx").on(table.createdAt),
    index("internal_workflow_imports_hash_idx").on(table.fileHash),
  ],
);

export type InternalWorkflowMatter = typeof internalWorkflowMattersTable.$inferSelect;
export type InternalWorkflowImport = typeof internalWorkflowImportsTable.$inferSelect;
