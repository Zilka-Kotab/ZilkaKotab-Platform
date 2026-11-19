import { sql } from "drizzle-orm";
import {
  boolean,
  date,
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
export const patentRecommendationEnum = pgEnum("patent_recommendation", [
  "NOT_ANALYZED",
  "MAINTAIN",
  "REVIEW",
  "PRUNE",
]);
export const analysisReviewStatusEnum = pgEnum("analysis_review_status", [
  "UNREVIEWED",
  "CLIENT_REVIEWED",
  "ATTORNEY_REVIEWED",
  "FINAL",
]);
export const analysisTypeEnum = pgEnum("analysis_type", [
  "GENERAL",
  "OVERVIEW",
  "CLAIM_SCOPE",
  "DETECTABILITY",
  "VALIDITY",
  "INFRINGEMENT",
]);

export const patentImportStatusEnum = pgEnum("patent_import_status", ["READY", "FAILED", "COMMITTED"]);
export const patentVerificationStatusEnum = pgEnum("patent_verification_status", ["PENDING", "VERIFIED", "MANUALLY_CORRECTED"]);
export const patentClaimTypeEnum = pgEnum("patent_claim_type", ["INDEPENDENT", "DEPENDENT", "UNKNOWN"]);
export const claimLimitationStateEnum = pgEnum("claim_limitation_state", ["DRAFT", "VERIFIED"]);
export const claimLimitationCreationMethodEnum = pgEnum("claim_limitation_creation_method", ["MANUAL", "AI_GENERATED"]);
export const claimLimitationHistoryActionEnum = pgEnum("claim_limitation_history_action", [
  "CREATED",
  "UPDATED",
  "SPLIT",
  "MERGED",
  "REORDERED",
  "DELETED",
  "VERIFIED",
  "UNVERIFIED",
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
    applicationNumber: varchar("application_number", { length: 40 }),
    filingDate: date("filing_date", { mode: "string" }),
    issueDate: date("issue_date", { mode: "string" }),
    earliestPriorityDate: date("earliest_priority_date", { mode: "string" }),
    assignee: text("assignee"),
    inventors: jsonb("inventors").notNull().default(sql`'[]'::jsonb`),
    abstract: text("abstract"),
    patentStatus: text("patent_status").notNull().default("UNKNOWN"),
    sourceStatus: text("source_status"),
    jurisdiction: varchar("jurisdiction", { length: 80 }).notNull().default("US"),
    sourceUrl: text("source_url"),
    source: varchar("source", { length: 120 }).notNull().default("USPTO"),
    sourceIdentifier: text("source_identifier"),
    retrievalMethod: varchar("retrieval_method", { length: 40 }).notNull().default("AUTOMATIC"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    verificationStatus: patentVerificationStatusEnum("verification_status").notNull().default("PENDING"),
    monitoringActive: boolean("monitoring_active").notNull().default(true),
    recommendation: patentRecommendationEnum("recommendation").notNull().default("NOT_ANALYZED"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedById: integer("archived_by_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("monitored_patents_public_id_unique").on(table.publicId),
    uniqueIndex("monitored_patents_project_number_unique").on(table.projectId, table.patentNumber),
    index("monitored_patents_project_idx").on(table.projectId),
  ],
);

export const patentAttorneyNotesTable = pgTable(
  "patent_attorney_notes",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    patentId: integer("patent_id").notNull().references(() => monitoredPatentsTable.id, { onDelete: "cascade" }),
    notes: text("notes").notNull().default(""),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    updatedById: integer("updated_by_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("patent_attorney_notes_public_id_unique").on(table.publicId),
    uniqueIndex("patent_attorney_notes_patent_unique").on(table.patentId),
    index("patent_attorney_notes_patent_idx").on(table.patentId),
  ],
);

export const patentAttorneyNoteHistoryTable = pgTable(
  "patent_attorney_note_history",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    noteId: integer("note_id").notNull().references(() => patentAttorneyNotesTable.id, { onDelete: "cascade" }),
    notes: text("notes").notNull(),
    actorId: integer("actor_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("patent_attorney_note_history_public_id_unique").on(table.publicId),
    index("patent_attorney_note_history_note_created_idx").on(table.noteId, table.createdAt),
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
    claimType: patentClaimTypeEnum("claim_type").notNull().default("UNKNOWN"),
    dependsOnClaimNumber: varchar("depends_on_claim_number", { length: 40 }),
    source: varchar("source", { length: 120 }).notNull().default("USPTO"),
    sourceIdentifier: text("source_identifier"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    verificationStatus: patentVerificationStatusEnum("verification_status").notNull().default("PENDING"),
    selectedForMonitoring: boolean("selected_for_monitoring").notNull().default(false),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("patent_claims_public_id_unique").on(table.publicId),
    uniqueIndex("patent_claims_patent_number_version_unique").on(table.patentId, table.claimNumber, table.version),
    index("patent_claims_patent_idx").on(table.patentId),
  ],
);

export const claimLimitationStructuresTable = pgTable(
  "claim_limitation_structures",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    claimVersionId: integer("claim_version_id").notNull().references(() => patentClaimsTable.id, { onDelete: "cascade" }),
    state: claimLimitationStateEnum("state").notNull().default("DRAFT"),
    verifiedById: integer("verified_by_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("claim_limitation_structures_public_id_unique").on(table.publicId),
    uniqueIndex("claim_limitation_structures_claim_version_unique").on(table.claimVersionId),
    index("claim_limitation_structures_state_idx").on(table.state),
  ],
);

export const claimLimitationsTable = pgTable(
  "claim_limitations",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    structureId: integer("structure_id").notNull().references(() => claimLimitationStructuresTable.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    identifier: varchar("identifier", { length: 40 }).notNull(),
    limitationText: text("limitation_text").notNull(),
    creationMethod: claimLimitationCreationMethodEnum("creation_method").notNull().default("MANUAL"),
    verificationStatus: claimLimitationStateEnum("verification_status").notNull().default("DRAFT"),
    verifiedById: integer("verified_by_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdById: integer("created_by_id").notNull().references(() => portalUsersTable.id),
    updatedById: integer("updated_by_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: integer("deleted_by_id").references(() => portalUsersTable.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("claim_limitations_public_id_unique").on(table.publicId),
    index("claim_limitations_structure_sequence_idx").on(table.structureId, table.sequence),
    index("claim_limitations_structure_status_idx").on(table.structureId, table.verificationStatus),
  ],
);

export const claimLimitationHistoryTable = pgTable(
  "claim_limitation_history",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    structureId: integer("structure_id").notNull().references(() => claimLimitationStructuresTable.id, { onDelete: "cascade" }),
    limitationId: integer("limitation_id").references(() => claimLimitationsTable.id, { onDelete: "set null" }),
    action: claimLimitationHistoryActionEnum("action").notNull(),
    sequence: integer("sequence"),
    identifier: varchar("identifier", { length: 40 }),
    limitationText: text("limitation_text"),
    creationMethod: claimLimitationCreationMethodEnum("creation_method"),
    verificationStatus: claimLimitationStateEnum("verification_status"),
    actorId: integer("actor_id").notNull().references(() => portalUsersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("claim_limitation_history_public_id_unique").on(table.publicId),
    index("claim_limitation_history_structure_created_idx").on(table.structureId, table.createdAt),
    index("claim_limitation_history_limitation_idx").on(table.limitationId),
  ],
);

export const patentImportDraftsTable = pgTable(
  "patent_import_drafts",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    submittedById: integer("submitted_by_id").notNull().references(() => portalUsersTable.id),
    normalizedPatentNumber: varchar("normalized_patent_number", { length: 100 }).notNull(),
    status: patentImportStatusEnum("status").notNull(),
    source: varchar("source", { length: 120 }).notNull().default("USPTO"),
    sourceIdentifier: text("source_identifier"),
    sourceUrl: text("source_url"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    errors: jsonb("errors").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("patent_import_drafts_public_id_unique").on(table.publicId),
    index("patent_import_drafts_project_created_idx").on(table.projectId, table.createdAt),
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
    analysisType: analysisTypeEnum("analysis_type").notNull().default("GENERAL"),
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
    index("analysis_runs_patent_type_created_idx").on(table.patentId, table.analysisType, table.createdAt),
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
export const insertPatentAttorneyNoteSchema = createInsertSchema(patentAttorneyNotesTable);
export const insertPatentAttorneyNoteHistorySchema = createInsertSchema(patentAttorneyNoteHistoryTable);
export const insertPatentClaimSchema = createInsertSchema(patentClaimsTable);
export const insertClaimLimitationStructureSchema = createInsertSchema(claimLimitationStructuresTable);
export const insertClaimLimitationSchema = createInsertSchema(claimLimitationsTable);
export const insertClaimLimitationHistorySchema = createInsertSchema(claimLimitationHistoryTable);
export const insertProjectWorkspaceItemSchema = createInsertSchema(projectWorkspaceItemsTable);
export const insertAnalysisRunSchema = createInsertSchema(analysisRunsTable);
export const insertAnalysisReviewSchema = createInsertSchema(analysisReviewsTable);

export type AiProcessingProvider = typeof projectAiConfigsTable.$inferSelect.selectedProvider;
export type DataClassification = typeof projectWorkspaceItemsTable.$inferSelect.classification;
export type PatentRecommendation = typeof patentRecommendationEnum.enumValues[number];
export type AnalysisRun = typeof analysisRunsTable.$inferSelect;
export type PatentAttorneyNote = typeof patentAttorneyNotesTable.$inferSelect;
export type PatentAttorneyNoteHistory = typeof patentAttorneyNoteHistoryTable.$inferSelect;
export type ClaimLimitationStructure = typeof claimLimitationStructuresTable.$inferSelect;
export type ClaimLimitation = typeof claimLimitationsTable.$inferSelect;
export type ClaimLimitationHistory = typeof claimLimitationHistoryTable.$inferSelect;