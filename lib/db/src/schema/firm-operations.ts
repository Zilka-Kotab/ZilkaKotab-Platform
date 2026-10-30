import { pgTable, serial, uuid, text, integer, date, timestamp, boolean, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import type { WorkflowBilling, FeeAllocation } from "./firm-fees";
import { portalUsersTable } from "./portal";
import { internalWorkflowDocketTasksTable, internalWorkflowTasksTable } from "./internal-workflow";

// AppColl fields remain in the source tables; firm-owned progress is never imported over.
export const firmWorkflowRowsTable = pgTable("firm_workflow_rows", {
  id: serial("id").primaryKey(),
  publicId: uuid("public_id").defaultRandom().notNull().unique(),
  sourceKey: text("source_key").notNull().unique(),
  docketTaskId: integer("docket_task_id").references(() => internalWorkflowDocketTasksTable.id),
  internalTaskId: integer("internal_task_id").references(() => internalWorkflowTasksTable.id),
  assignedToId: integer("assigned_to_id").references(() => portalUsersTable.id),
  priorityDeadline: date("priority_deadline", { mode: "string" }),
  billingDraft: jsonb("billing_draft").$type<WorkflowBilling>(),
  status: text("status").notNull().default("Unassigned"),
  statusDate: date("status_date", { mode: "string" }),
  statusNote: text("status_note").notNull().default(""),
  strategySentOn: date("strategy_sent_on", { mode: "string" }),
  clientApprovalSentOn: date("client_approval_sent_on", { mode: "string" }),
  paralegalSentOn: date("paralegal_sent_on", { mode: "string" }),
  filedOn: date("filed_on", { mode: "string" }),
  notes: text("notes").notNull().default(""),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const firmWorkflowStatusHistoryTable = pgTable("firm_workflow_status_history", {
  id: serial("id").primaryKey(),
  publicId: uuid("public_id").defaultRandom().notNull().unique(),
  workflowRowId: integer("workflow_row_id").notNull().references(() => firmWorkflowRowsTable.id),
  status: text("status").notNull(),
  statusDate: date("status_date", { mode: "string" }).notNull(),
  note: text("note").notNull().default(""),
  actorId: integer("actor_id").references(() => portalUsersTable.id),
  migrationKey: text("migration_key").unique(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const firmBillingItemsTable = pgTable("firm_billing_items", {
  id: serial("id").primaryKey(),
  publicId: uuid("public_id").defaultRandom().notNull().unique(),
  workflowRowId: integer("workflow_row_id").references(() => firmWorkflowRowsTable.id),
  ownerId: integer("owner_id").notNull().references(() => portalUsersTable.id),
  kind: text("kind").notNull().default("FEE"),
  workDate: date("work_date", { mode: "string" }).notNull(),
  prebilledOn: date("prebilled_on", { mode: "string" }),
  client: text("client").notNull().default(""),
  matter: text("matter").notNull().default(""),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  notes: text("notes").notNull().default(""),
  code: text("code").notNull().default(""),
  jurisdiction: text("jurisdiction").notNull().default(""),
  subjectMatter: text("subject_matter").notNull().default(""),
  associate: text("associate").notNull().default(""),
  shareBasisPoints: integer("share_basis_points").notNull().default(10000),
  allocations: jsonb("allocations").$type<FeeAllocation[]>().notNull().default([]),
  invoiceNumber: text("invoice_number").notNull().default(""),
  invoiceDate: date("invoice_date", { mode: "string" }),
  voided: boolean("voided").notNull().default(false),
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("firm_billing_workflow_unique").on(t.workflowRowId)]);

export const firmPaymentsTable = pgTable("firm_payments", {
  id: serial("id").primaryKey(),
  publicId: uuid("public_id").defaultRandom().notNull().unique(),
  billingItemId: integer("billing_item_id").notNull().references(() => firmBillingItemsTable.id),
  amountCents: integer("amount_cents").notNull(),
  receivedOn: date("received_on", { mode: "string" }).notNull(),
  reference: text("reference").notNull().default(""),
  requestId: uuid("request_id").notNull().unique(),
  createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
