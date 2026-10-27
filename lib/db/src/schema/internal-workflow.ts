import {
  boolean,
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

export const internalWorkflowDocketTasksTable = pgTable("internal_workflow_docket_tasks", {
  id: serial("id").primaryKey(),
  publicId: uuid("public_id").defaultRandom().notNull(),
  externalTaskId: varchar("external_task_id", { length: 240 }).notNull(),
  matterId: integer("matter_id").notNull().references(() => internalWorkflowMattersTable.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  officialDueDate: date("official_due_date", { mode: "string" }),
  status: varchar("status", { length: 80 }).notNull().default(""),
  assignedPractitioner: varchar("assigned_practitioner", { length: 240 }).notNull().default(""),
  completedDate: date("completed_date", { mode: "string" }),
  rawRecord: jsonb("raw_record").$type<AppCollMatterRecord>().notNull().default({}),
  lastImportedAt: timestamp("last_imported_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("internal_workflow_docket_tasks_public_id_unique").on(table.publicId),
  uniqueIndex("internal_workflow_docket_tasks_external_id_unique").on(table.externalTaskId),
  index("internal_workflow_docket_tasks_matter_due_idx").on(table.matterId, table.officialDueDate),
]);

export const internalWorkflowDocketTaskImportsTable = pgTable("internal_workflow_docket_task_imports", {
  id: serial("id").primaryKey(),
  publicId: uuid("public_id").defaultRandom().notNull(),
  fileName: text("file_name").notNull(),
  fileHash: varchar("file_hash", { length: 64 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("REVIEW"),
  previewData: jsonb("preview_data").$type<Array<Record<string, string>> | null>(),
  mapping: jsonb("mapping").$type<Record<string, string>>().notNull().default({}),
  summary: jsonb("summary").$type<Record<string, number>>().notNull().default({}),
  exceptions: jsonb("exceptions").$type<Array<{ row: number; field: string; message: string }>>().notNull().default([]),
  createdBy: integer("created_by").notNull().references(() => portalUsersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("internal_workflow_docket_task_imports_public_id_unique").on(table.publicId),
  uniqueIndex("internal_workflow_docket_task_imports_file_hash_unique").on(table.fileHash),
  index("internal_workflow_docket_task_imports_created_idx").on(table.createdAt),
]);

export const internalWorkflowDocketTaskChangesTable = pgTable("internal_workflow_docket_task_changes", {
  id: serial("id").primaryKey(),
  docketTaskId: integer("docket_task_id").notNull().references(() => internalWorkflowDocketTasksTable.id, { onDelete: "cascade" }),
  importId: integer("import_id").references(() => internalWorkflowDocketTaskImportsTable.id, { onDelete: "set null" }),
  actorId: integer("actor_id").notNull().references(() => portalUsersTable.id),
  previousDueDate: date("previous_due_date", { mode: "string" }),
  nextDueDate: date("next_due_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("internal_workflow_docket_task_changes_task_idx").on(table.docketTaskId, table.createdAt)]);

export const internalWorkflowTasksTable = pgTable(
  "internal_workflow_tasks",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    matterId: integer("matter_id").references(() => internalWorkflowMattersTable.id, { onDelete: "set null" }),
    parentTaskId: integer("parent_task_id"),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    responsibleAttorneyId: integer("responsible_attorney_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    assignedById: integer("assigned_by_id").notNull().references(() => portalUsersTable.id),
    assignedToId: integer("assigned_to_id").notNull().references(() => portalUsersTable.id),
    officialDueDate: date("official_due_date", { mode: "string" }),
    internalTargetDate: date("internal_target_date", { mode: "string" }),
    workflowStatus: varchar("workflow_status", { length: 32 }).notNull().default("PENDING_WITH_ME"),
    strategyStatus: varchar("strategy_status", { length: 32 }).notNull().default("NOT_APPLICABLE"),
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
    index("internal_workflow_tasks_parent_idx").on(table.parentTaskId),
  ],
);

export const internalWorkflowCommentsTable = pgTable(
  "internal_workflow_comments",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    taskId: integer("task_id").notNull().references(() => internalWorkflowTasksTable.id, { onDelete: "cascade" }),
    authorId: integer("author_id").notNull().references(() => portalUsersTable.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("internal_workflow_comments_public_id_unique").on(table.publicId), index("internal_workflow_comments_task_idx").on(table.taskId, table.createdAt)],
);

export const internalWorkflowContributorsTable = pgTable(
  "internal_workflow_contributors",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id").notNull().references(() => internalWorkflowTasksTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => portalUsersTable.id),
    allocationCents: integer("allocation_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("internal_workflow_contributors_task_user_unique").on(table.taskId, table.userId)],
);

export const internalWorkflowTimeEntriesTable = pgTable(
  "internal_workflow_time_entries",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    taskId: integer("task_id").notNull().references(() => internalWorkflowTasksTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => portalUsersTable.id),
    workDate: date("work_date", { mode: "string" }).notNull(),
    minutes: integer("minutes").notNull(),
    narrative: text("narrative").notNull().default(""),
    billable: boolean("billable").notNull().default(true),
    billingCode: varchar("billing_code", { length: 40 }).notNull().default("PROSECUTION"),
    rateCents: integer("rate_cents").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    approvalStatus: varchar("approval_status", { length: 20 }).notNull().default("PENDING"),
    reviewedById: integer("reviewed_by_id").references(() => portalUsersTable.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    exportedAt: timestamp("exported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("internal_workflow_time_entries_public_id_unique").on(table.publicId), index("internal_workflow_time_user_idx").on(table.userId, table.workDate), index("internal_workflow_time_review_idx").on(table.approvalStatus, table.workDate)],
);

export const internalWorkflowTimerSessionsTable = pgTable(
  "internal_workflow_timer_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => portalUsersTable.id),
    taskId: integer("task_id").notNull().references(() => internalWorkflowTasksTable.id, { onDelete: "cascade" }),
    state: varchar("state", { length: 12 }).notNull().default("RUNNING"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    resumedAt: timestamp("resumed_at", { withTimezone: true }).notNull().defaultNow(),
    accumulatedSeconds: integer("accumulated_seconds").notNull().default(0),
  },
  (table) => [index("internal_workflow_timer_user_idx").on(table.userId, table.state)],
);

export const internalWorkflowNotificationsTable = pgTable(
  "internal_workflow_notifications",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    userId: integer("user_id").notNull().references(() => portalUsersTable.id, { onDelete: "cascade" }),
    taskId: integer("task_id").references(() => internalWorkflowTasksTable.id, { onDelete: "cascade" }),
    dedupeKey: varchar("dedupe_key", { length: 240 }),
    title: varchar("title", { length: 180 }).notNull(),
    message: text("message").notNull().default(""),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("internal_workflow_notifications_public_id_unique").on(table.publicId), uniqueIndex("internal_workflow_notifications_dedupe_unique").on(table.dedupeKey), index("internal_workflow_notifications_user_idx").on(table.userId, table.createdAt)],
);

export const internalWorkflowNotificationPreferencesTable = pgTable("internal_workflow_notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => portalUsersTable.id, { onDelete: "cascade" }),
  deadlineMode: varchar("deadline_mode", { length: 24 }).notNull().default("IMMEDIATE"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("internal_workflow_notification_preferences_user_unique").on(table.userId)]);

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
