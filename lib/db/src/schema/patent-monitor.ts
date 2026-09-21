import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { portalUsersTable, projectsTable } from "./portal";

export const aiProcessingProviderEnum = pgEnum("ai_processing_provider", [
  "CLIENT_MICROSOFT",
  "ZK_MANAGED_AI",
  "MANUAL",
]);
export const dataClassificationEnum = pgEnum("data_classification", [
  "PUBLIC_SOURCE",
  "CLIENT_CONFIDENTIAL",
  "ATTORNEY_WORK_PRODUCT",
]);
export const analysisTriageEnum = pgEnum("analysis_triage", ["HIGH", "MEDIUM", "LOW"]);
export const analysisReviewStatusEnum = pgEnum("analysis_review_status", [
  "UNREVIEWED",
  "CLIENT_REVIEWED",
  "ATTORNEY_REVIEWED",
  "FINAL",
]);

export const projectAiConfigsTable = pgTable("project_ai_configs", {
  projectId: integer("project_id").primaryKey().references(() => projectsTable.id, { onDelete: "cascade" }),
  selectedProvider: aiProcessingProviderEnum("selected_provider").notNull().default("MANUAL"),
  allowedProviders: aiProcessingProviderEnum("allowed_providers").array().notNull().default(sql`ARRAY['MANUAL']::ai_processing_provider[]`),
  updatedById: integer("updated_by_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const monitoredPatentsTable = pgTable(
  "monitored_patents",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    patentNumber: varchar("patent_number", { length: 100 }).notNull(),
    title: text("title").notNull(),
    jurisdiction: varchar("jurisdiction", { length: 80 }).notNull().default("US"),
    sourceUrl: text("source_url"),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("monitored_patents_public_id_unique").on(table.publicId),
    uniqueIndex("monitored_patents_project_number_unique").on(table.projectId, table.patentNumber),
    index("monitored_patents_project_idx").on(table.projectId),
  ],
);

export const patentClaimsTable = pgTable(
  "patent_claims",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    patentId: integer("patent_id").notNull().references(() => monitoredPatentsTable.id, { onDelete: "cascade" }),
    claimNumber: varchar("claim_number", { length: 40 }).notNull(),
    version: integer("version").notNull().default(1),
    claimText: text("claim_text").notNull(),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("patent_claims_public_id_unique").on(table.publicId),
    uniqueIndex("patent_claims_patent_number_version_unique").on(table.patentId, table.claimNumber, table.version),
    index("patent_claims_patent_idx").on(table.patentId),
  ],
);

export const projectWorkspaceItemsTable = pgTable(
  "project_workspace_items",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    itemType: varchar("item_type", { length: 80 }).notNull(),
    content: text("content").notNull().default(""),
    sourceUrl: text("source_url"),
    classification: dataClassificationEnum("classification").notNull(),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_workspace_items_public_id_unique").on(table.publicId),
    index("project_workspace_items_project_idx").on(table.projectId),
    index("project_workspace_items_classification_idx").on(table.classification),
  ],
);

export const analysisRunsTable = pgTable(
  "analysis_runs",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    patentId: integer("patent_id").references(() => monitoredPatentsTable.id, { onDelete: "set null" }),
    claimId: integer("claim_id").references(() => patentClaimsTable.id, { onDelete: "set null" }),
    provider: aiProcessingProviderEnum("provider").notNull(),
    triage: analysisTriageEnum("triage").notNull(),
    reviewStatus: analysisReviewStatusEnum("review_status").notNull().default("UNREVIEWED"),
    summary: text("summary").notNull(),
    limitationAnalysis: jsonb("limitation_analysis").notNull().default(sql`'[]'::jsonb`),
    evidence: jsonb("evidence").notNull().default(sql`'[]'::jsonb`),
    inputProvenance: jsonb("input_provenance").notNull().default(sql`'{}'::jsonb`),
    providerProvenance: jsonb("provider_provenance").notNull().default(sql`'{}'::jsonb`),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("analysis_runs_public_id_unique").on(table.publicId),
    index("analysis_runs_project_created_idx").on(table.projectId, table.createdAt),
    index("analysis_runs_patent_idx").on(table.patentId),
  ],
);

export const analysisReviewsTable = pgTable(
  "analysis_reviews",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    analysisRunId: integer("analysis_run_id").notNull().references(() => analysisRunsTable.id, { onDelete: "cascade" }),
    status: analysisReviewStatusEnum("status").notNull(),
    note: text("note").notNull().default(""),
    classification: dataClassificationEnum("classification").notNull().default("ATTORNEY_WORK_PRODUCT"),
    reviewerId: integer("reviewer_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("analysis_reviews_public_id_unique").on(table.publicId),
    index("analysis_reviews_run_created_idx").on(table.analysisRunId, table.createdAt),
  ],
);

export const insertProjectAiConfigSchema = createInsertSchema(projectAiConfigsTable);
export const insertMonitoredPatentSchema = createInsertSchema(monitoredPatentsTable);
export const insertPatentClaimSchema = createInsertSchema(patentClaimsTable);
export const insertProjectWorkspaceItemSchema = createInsertSchema(projectWorkspaceItemsTable);
export const insertAnalysisRunSchema = createInsertSchema(analysisRunsTable);
export const insertAnalysisReviewSchema = createInsertSchema(analysisReviewsTable);

export type AiProcessingProvider = typeof projectAiConfigsTable.$inferSelect.selectedProvider;
export type DataClassification = typeof projectWorkspaceItemsTable.$inferSelect.classification;
export type AnalysisRun = typeof analysisRunsTable.$inferSelect;