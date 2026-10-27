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

export const internalWorkflowTasksTable = pgTable(
  "internal_workflow_tasks",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    matterId: integer("matter_id").references(() => internalWorkflowMattersTable.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    responsibleAttorneyId: integer("responsible_attorney_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    assignedById: integer("assigned_by_id").notNull().references(() => portalUsersTable.id),
    assignedToId: integer("assigned_to_id").notNull().references(() => portalUsersTable.id),
    officialDueDate: date("official_due_date", { mode: "string" }),
    internalTargetDate: date("internal_target_date", { mode: "string" }),
    workflowStatus: varchar("workflow_status", { length: 32 }).notNull().default("OPEN"),
    priority: varchar("priority", { length: 16 }).notNull().default("NORMAL"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("internal_workflow_tasks_public_id_unique").on(table.publicId),
    index("internal_workflow_tasks_assigned_to_idx").on(table.assignedToId, table.workflowStatus),
    index("internal_workflow_tasks_created_by_idx").on(table.createdById, table.workflowStatus),
    index("internal_workflow_tasks_matter_idx").on(table.matterId),
  ],
);

export const internalWorkflowTaskAuditTable = pgTable(
  "internal_workflow_task_audit",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id").notNull().references(() => internalWorkflowTasksTable.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").notNull().references(() => portalUsersTable.id),
    action: varchar("action", { length: 32 }).notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("internal_workflow_task_audit_task_idx").on(table.taskId, table.createdAt)],
);

export type InternalWorkflowMatter = typeof internalWorkflowMattersTable.$inferSelect;
export type InternalWorkflowImport = typeof internalWorkflowImportsTable.$inferSelect;
export type InternalWorkflowTask = typeof internalWorkflowTasksTable.$inferSelect;
