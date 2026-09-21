import { Router } from "express";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import {
  analysisReviewsTable,
  analysisRunsTable,
  attorneyClientsTable,
  clientToolsTable,
  clientUsersTable,
  db,
  monitoredPatentsTable,
  patentImportDraftsTable,
  patentClaimsTable,
  projectAiConfigsTable,
  projectsTable,
  projectUsersTable,
  projectWorkspaceItemsTable,
  toolsTable,
  clientsTable,
  type AiProcessingProvider,
  type DataClassification,
  type PortalUser,
} from "@workspace/db";
import { requireAdmin, requirePortalAccess } from "../middlewares/portalAccess";
import { projectRelations, serializeClient, serializeProject, serializeTool } from "../lib/portal-resources";
import { normalizePatentNumbers, retrievePatent, type PatentImportPayload } from "../lib/uspto";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdOf = (value: unknown) => typeof value === "string" && UUID.test(value) ? value : "";
const validId = (value: number) => Number.isSafeInteger(value) && value > 0;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const provider = (value: unknown): AiProcessingProvider | null =>
  value === "CLIENT_MICROSOFT" || value === "ZK_MANAGED_AI" || value === "MANUAL" ? value : null;
const classification = (value: unknown): DataClassification | null =>
  value === "PUBLIC_SOURCE" || value === "CLIENT_CONFIDENTIAL" || value === "ATTORNEY_WORK_PRODUCT" ? value : null;
const triage = (value: unknown) =>
  value === "HIGH" || value === "MEDIUM" || value === "LOW" ? value : null;
const reviewStatus = (value: unknown) =>
  value === "CLIENT_REVIEWED" || value === "ATTORNEY_REVIEWED" || value === "FINAL" ? value : null;
const jsonArray = (value: unknown) => Array.isArray(value) ? value : [];
const jsonObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function accessibleProject(user: PortalUser, projectPublicId: string) {
  const [project] = await db.select().from(projectsTable).where(and(
    eq(projectsTable.publicId, projectPublicId),
    eq(projectsTable.active, true),
  )).limit(1);
  if (!project) return null;
  if (user.role !== "ADMIN") {
    const assignment = user.role === "CLIENT"
      ? await db.select().from(clientUsersTable).where(and(eq(clientUsersTable.userId, user.id), eq(clientUsersTable.clientId, project.clientId))).limit(1)
      : await db.select().from(attorneyClientsTable).where(and(eq(attorneyClientsTable.attorneyUserId, user.id), eq(attorneyClientsTable.clientId, project.clientId))).limit(1);
    if (!assignment.length) return null;
  }
  const enabled = await db.select().from(clientToolsTable).where(and(
    eq(clientToolsTable.clientId, project.clientId),
    eq(clientToolsTable.toolId, project.toolId),
    eq(clientToolsTable.active, true),
  )).limit(1);
  if (!enabled.length) return null;
  if (user.role === "CLIENT") {
    const permission = await db.select().from(projectUsersTable).where(and(
      eq(projectUsersTable.userId, user.id),
      eq(projectUsersTable.projectId, project.id),
    )).limit(1);
    if (!permission.length) return null;
  }
  return project;
}

async function patentProject(user: PortalUser, patentPublicId: string) {
  const [patent] = await db.select().from(monitoredPatentsTable).where(eq(monitoredPatentsTable.publicId, patentPublicId)).limit(1);
  const [project] = patent
    ? await db.select().from(projectsTable).where(eq(projectsTable.id, patent.projectId)).limit(1)
    : [];
  if (!patent || !project || !(await accessibleProject(user, project.publicId))) return null;
  return patent;
}

function serializeClaim(claim: typeof patentClaimsTable.$inferSelect, patentPublicId: string) {
  return {
    publicId: claim.publicId,
    patentId: patentPublicId,
    claimNumber: claim.claimNumber,
    version: claim.version,
    claimText: claim.claimText,
    claimType: claim.claimType,
    dependsOnClaimNumber: claim.dependsOnClaimNumber,
    source: claim.source,
    sourceIdentifier: claim.sourceIdentifier,
    retrievedAt: claim.retrievedAt,
    verificationStatus: claim.verificationStatus,
    selectedForMonitoring: claim.selectedForMonitoring,
    createdAt: claim.createdAt,
  };
}

function latestClaims(claims: typeof patentClaimsTable.$inferSelect[]) {
  const current = new Map<string, typeof patentClaimsTable.$inferSelect>();
  for (const claim of claims) {
    const existing = current.get(claim.claimNumber);
    if (!existing || claim.version > existing.version) current.set(claim.claimNumber, claim);
  }
  return [...current.values()].sort((a, b) => Number(a.claimNumber) - Number(b.claimNumber));
}

function serializePatent(patent: typeof monitoredPatentsTable.$inferSelect, projectPublicId: string, claims: typeof patentClaimsTable.$inferSelect[]) {
  return {
    publicId: patent.publicId,
    projectId: projectPublicId,
    patentNumber: patent.patentNumber,
    title: patent.title,
    applicationNumber: patent.applicationNumber,
    filingDate: patent.filingDate,
    issueDate: patent.issueDate,
    earliestPriorityDate: patent.earliestPriorityDate,
    assignee: patent.assignee,
    inventors: patent.inventors,
    abstract: patent.abstract,
    patentStatus: patent.patentStatus,
    jurisdiction: patent.jurisdiction,
    sourceUrl: patent.sourceUrl,
    source: patent.source,
    sourceIdentifier: patent.sourceIdentifier,
    retrievalMethod: patent.retrievalMethod,
    retrievedAt: patent.retrievedAt,
    verificationStatus: patent.verificationStatus,
    monitoringActive: patent.monitoringActive,
    lastAnalyzedAt: patent.lastAnalyzedAt,
    createdAt: patent.createdAt,
    claims: latestClaims(claims).map((claim) => serializeClaim(claim, patent.publicId)),
  };
}

function draftPayload(draft: typeof patentImportDraftsTable.$inferSelect) {
  return draft.payload as PatentImportPayload;
}

function serializeImportDraft(draft: typeof patentImportDraftsTable.$inferSelect) {
  const payload = draftPayload(draft);
  return {
    publicId: draft.publicId,
    normalizedPatentNumber: draft.normalizedPatentNumber,
    status: draft.status,
    source: draft.source,
    sourceIdentifier: draft.sourceIdentifier,
    sourceUrl: draft.sourceUrl,
    retrievedAt: draft.retrievedAt,
    errors: draft.errors,
    patent: payload,
  };
}

function serializeWorkspaceItem(item: typeof projectWorkspaceItemsTable.$inferSelect, projectPublicId: string) {
  return {
    publicId: item.publicId,
    projectId: projectPublicId,
    title: item.title,
    itemType: item.itemType,
    content: item.content,
    sourceUrl: item.sourceUrl,
    classification: item.classification,
    createdAt: item.createdAt,
  };
}

function serializeReview(review: typeof analysisReviewsTable.$inferSelect, analysisRunPublicId: string) {
  return {
    publicId: review.publicId,
    analysisRunId: analysisRunPublicId,
    status: review.status,
    note: review.note,
    classification: review.classification,
    createdAt: review.createdAt,
  };
}

function serializeRun(
  run: typeof analysisRunsTable.$inferSelect,
  projectPublicId: string,
  patentsById: Map<number, string>,
  claimsById: Map<number, string>,
  reviews: typeof analysisReviewsTable.$inferSelect[],
) {
  return {
    publicId: run.publicId,
    projectId: projectPublicId,
    patentId: run.patentId ? patentsById.get(run.patentId) ?? null : null,
    claimId: run.claimId ? claimsById.get(run.claimId) ?? null : null,
    provider: run.provider,
    triage: run.triage,
    reviewStatus: run.reviewStatus,
    summary: run.summary,
    limitationAnalysis: run.limitationAnalysis,
    evidence: run.evidence,
    createdAt: run.createdAt,
    reviews: reviews.map((review) => serializeReview(review, run.publicId)),
  };
}

router.use("/portal", requirePortalAccess);

router.post("/portal/projects/:id/patent-imports/preview", async (req, res) => {
  const projectPublicId = publicIdOf(req.params.id);
  const project = projectPublicId ? await accessibleProject(req.portalUser!, projectPublicId) : null;
  if (!project) return void res.status(404).json({ error: "Project not found." });

  const input = typeof req.body?.patentNumbers === "string"
    ? req.body.patentNumbers
    : typeof req.body?.patentNumber === "string" ? req.body.patentNumber : "";
  const normalizedNumbers = normalizePatentNumbers(input);
  if (!normalizedNumbers.length) return void res.status(400).json({ error: "Enter one or more valid U.S. patent numbers." });
  if (normalizedNumbers.length > 20) return void res.status(400).json({ error: "Import up to 20 patents at a time." });

  const drafts = [];
  for (const normalizedPatentNumber of normalizedNumbers) {
    let payload: PatentImportPayload;
    let status: "READY" | "FAILED" = "READY";
    let errors: string[] = [];
    try {
      payload = await retrievePatent(normalizedPatentNumber);
      errors = payload.errors;
      if (payload.errors.length || !payload.title || !payload.claims.length) status = "FAILED";
    } catch (error) {
      status = "FAILED";
      errors = [error instanceof Error ? error.message : "USPTO retrieval failed."];
      payload = {
        normalizedPatentNumber,
        title: "",
        applicationNumber: null,
        filingDate: null,
        issueDate: null,
        earliestPriorityDate: null,
        assignee: null,
        inventors: [],
        abstract: null,
        patentStatus: "UNKNOWN",
        jurisdiction: "US",
        source: "USPTO",
        sourceIdentifier: normalizedPatentNumber,
        sourceUrl: null,
        retrievedAt: new Date().toISOString(),
        claims: [],
        errors,
      };
    }
    const [draft] = await db.insert(patentImportDraftsTable).values({
      projectId: project.id,
      submittedById: req.portalUser!.id,
      normalizedPatentNumber,
      status,
      source: "USPTO",
      sourceIdentifier: payload.sourceIdentifier,
      sourceUrl: payload.sourceUrl,
      retrievedAt: payload.retrievedAt ? new Date(payload.retrievedAt) : null,
      payload: payload as unknown as Record<string, unknown>,
      errors,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }).returning();
    drafts.push(serializeImportDraft(draft));
  }
  res.status(201).json({ drafts });
});

router.post("/portal/patent-imports/:id/commit", async (req, res) => {
  const draftPublicId = publicIdOf(req.params.id);
  const [draft] = draftPublicId
    ? await db.select().from(patentImportDraftsTable).where(eq(patentImportDraftsTable.publicId, draftPublicId)).limit(1)
    : [];
  const [project] = draft ? await db.select().from(projectsTable).where(eq(projectsTable.id, draft.projectId)).limit(1) : [];
  if (!draft || !project || !(await accessibleProject(req.portalUser!, project.publicId))) {
    return void res.status(404).json({ error: "Patent import draft not found." });
  }
  if (draft.status !== "READY") return void res.status(409).json({ error: "This patent retrieval is incomplete and cannot be added automatically." });
  if (draft.expiresAt && draft.expiresAt.getTime() < Date.now()) return void res.status(409).json({ error: "This patent review has expired. Retrieve the patent again." });

  const payload = draftPayload(draft);
  const claims = Array.isArray(payload.claims) ? payload.claims : [];
  const independentClaims = claims.filter((claim) => claim.claimType === "INDEPENDENT");
  const requestedSelection = Array.isArray(req.body?.selectedClaimNumbers)
    ? req.body.selectedClaimNumbers.filter((value: unknown): value is string => typeof value === "string")
    : independentClaims.filter((claim) => claim.selectedForMonitoring).map((claim) => claim.claimNumber);
  const selectedClaimNumbers = new Set(requestedSelection);
  if (independentClaims.length && !independentClaims.some((claim) => selectedClaimNumbers.has(claim.claimNumber))) {
    return void res.status(400).json({ error: "Select at least one independent claim for monitoring." });
  }
  if ([...selectedClaimNumbers].some((claimNumber) => !independentClaims.some((claim) => claim.claimNumber === claimNumber))) {
    return void res.status(400).json({ error: "Only independent claims can be selected for monitoring." });
  }

  const [existing] = await db.select({ publicId: monitoredPatentsTable.publicId })
    .from(monitoredPatentsTable)
    .where(and(
      eq(monitoredPatentsTable.projectId, project.id),
      eq(monitoredPatentsTable.patentNumber, payload.normalizedPatentNumber),
    ))
    .limit(1);
  if (existing) return void res.status(409).json({ error: "This patent is already being monitored in this project.", patentId: existing.publicId });

  const [patent, insertedClaims] = await db.transaction(async (tx) => {
    const [createdPatent] = await tx.insert(monitoredPatentsTable).values({
      projectId: project.id,
      patentNumber: payload.normalizedPatentNumber,
      title: payload.title,
      applicationNumber: payload.applicationNumber,
      filingDate: payload.filingDate,
      issueDate: payload.issueDate,
      earliestPriorityDate: payload.earliestPriorityDate,
      assignee: payload.assignee,
      inventors: payload.inventors,
      abstract: payload.abstract,
      patentStatus: payload.patentStatus,
      jurisdiction: payload.jurisdiction,
      sourceUrl: payload.sourceUrl,
      source: payload.source,
      sourceIdentifier: payload.sourceIdentifier,
      retrievalMethod: "AUTOMATIC",
      retrievedAt: payload.retrievedAt ? new Date(payload.retrievedAt) : new Date(),
      verificationStatus: "PENDING",
      monitoringActive: true,
      createdById: req.portalUser!.id,
    }).returning();
    const createdClaims = claims.length
      ? await tx.insert(patentClaimsTable).values(claims.map((claim) => ({
          patentId: createdPatent.id,
          claimNumber: claim.claimNumber,
          version: 1,
          claimText: claim.claimText,
          claimType: claim.claimType,
          dependsOnClaimNumber: claim.dependsOnClaimNumber,
          source: payload.source,
          sourceIdentifier: payload.sourceIdentifier,
          retrievedAt: payload.retrievedAt ? new Date(payload.retrievedAt) : new Date(),
          verificationStatus: "PENDING" as const,
          selectedForMonitoring: selectedClaimNumbers.has(claim.claimNumber),
          createdById: req.portalUser!.id,
        }))).returning()
      : [];
    await tx.update(patentImportDraftsTable).set({ status: "COMMITTED" }).where(eq(patentImportDraftsTable.id, draft.id));
    return [createdPatent, createdClaims] as const;
  });
  res.status(201).json({
    patent: serializePatent(patent, project.publicId, insertedClaims),
  });
});

router.get("/portal/projects/:id/workspace", async (req, res) => {
  const projectPublicId = publicIdOf(req.params.id);
  const project = projectPublicId ? await accessibleProject(req.portalUser!, projectPublicId) : null;
  if (!project) return void res.status(404).json({ error: "Project not found." });
  const projectId = project.id;

  const [aiConfig] = await db.select().from(projectAiConfigsTable).where(eq(projectAiConfigsTable.projectId, projectId)).limit(1);
  const patents = await db.select().from(monitoredPatentsTable).where(eq(monitoredPatentsTable.projectId, projectId)).orderBy(asc(monitoredPatentsTable.patentNumber));
  const claims = patents.length
    ? await db.select().from(patentClaimsTable).where(inArray(patentClaimsTable.patentId, patents.map((item) => item.id))).orderBy(asc(patentClaimsTable.claimNumber), desc(patentClaimsTable.version))
    : [];
  const itemFilter = req.portalUser!.role === "CLIENT"
    ? and(eq(projectWorkspaceItemsTable.projectId, projectId), ne(projectWorkspaceItemsTable.classification, "ATTORNEY_WORK_PRODUCT"))
    : eq(projectWorkspaceItemsTable.projectId, projectId);
  const workspaceItems = await db.select().from(projectWorkspaceItemsTable).where(itemFilter).orderBy(desc(projectWorkspaceItemsTable.createdAt));
  const analysisRuns = await db.select().from(analysisRunsTable).where(eq(analysisRunsTable.projectId, projectId)).orderBy(desc(analysisRunsTable.createdAt));
  const reviews = analysisRuns.length
    ? await db.select().from(analysisReviewsTable).where(inArray(analysisReviewsTable.analysisRunId, analysisRuns.map((run) => run.id))).orderBy(asc(analysisReviewsTable.createdAt))
    : [];
  const visibleReviews = req.portalUser!.role === "CLIENT"
    ? reviews.filter((review) => review.classification !== "ATTORNEY_WORK_PRODUCT")
    : reviews;
  const patentsById = new Map(patents.map((patent) => [patent.id, patent.publicId]));
  const claimsById = new Map(claims.map((claim) => [claim.id, claim.publicId]));
  const { client, tool } = await projectRelations(project);
  res.json({
    project: await serializeProject(project),
    tool: serializeTool(tool),
    client: serializeClient(client),
    aiConfig: aiConfig
      ? { projectId: project.publicId, selectedProvider: aiConfig.selectedProvider, allowedProviders: aiConfig.allowedProviders }
      : { projectId: project.publicId, selectedProvider: "MANUAL", allowedProviders: ["MANUAL"] },
    patents: patents.map((patent) => serializePatent(patent, project.publicId, claims.filter((claim) => claim.patentId === patent.id))),
    workspaceItems: workspaceItems.map((item) => serializeWorkspaceItem(item, project.publicId)),
    analysisRuns: analysisRuns.map((run) => serializeRun(run, project.publicId, patentsById, claimsById, visibleReviews.filter((review) => review.analysisRunId === run.id))),
  });
});

router.get("/portal/patents/:id", async (req, res) => {
  const patentPublicId = publicIdOf(req.params.id);
  const patent = patentPublicId ? await patentProject(req.portalUser!, patentPublicId) : null;
  if (!patent) return void res.status(404).json({ error: "Patent not found." });
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, patent.projectId)).limit(1);
  if (!project) return void res.status(404).json({ error: "Patent project not found." });
  const claims = await db.select().from(patentClaimsTable)
    .where(eq(patentClaimsTable.patentId, patent.id))
    .orderBy(asc(patentClaimsTable.claimNumber), desc(patentClaimsTable.version));
  const runs = await db.select().from(analysisRunsTable)
    .where(and(eq(analysisRunsTable.projectId, project.id), eq(analysisRunsTable.patentId, patent.id)))
    .orderBy(desc(analysisRunsTable.createdAt));
  const reviews = runs.length
    ? await db.select().from(analysisReviewsTable).where(inArray(analysisReviewsTable.analysisRunId, runs.map((run) => run.id))).orderBy(asc(analysisReviewsTable.createdAt))
    : [];
  const patentsById = new Map([[patent.id, patent.publicId]]);
  const claimsById = new Map(claims.map((claim) => [claim.id, claim.publicId]));
  const { client, tool } = await projectRelations(project);
  res.json({
    patent: serializePatent(patent, project.publicId, claims),
    project: await serializeProject(project),
    client: serializeClient(client),
    tool: serializeTool(tool),
    analysisRuns: runs.map((run) => serializeRun(run, project.publicId, patentsById, claimsById, reviews.filter((review) => review.analysisRunId === run.id))),
  });
});

router.post("/portal/patents/:id/refresh", async (req, res) => {
  const patentPublicId = publicIdOf(req.params.id);
  const patent = patentPublicId ? await patentProject(req.portalUser!, patentPublicId) : null;
  if (!patent) return void res.status(404).json({ error: "Patent not found." });

  let payload: PatentImportPayload;
  try {
    payload = await retrievePatent(patent.patentNumber);
  } catch (error) {
    return void res.status(error instanceof Error && "status" in error ? Number((error as { status?: unknown }).status) || 502 : 502).json({
      error: error instanceof Error ? error.message : "USPTO refresh failed.",
    });
  }
  if (payload.errors.length || !payload.title || !payload.claims.length) {
    return void res.status(422).json({
      error: "USPTO refresh was incomplete. Existing claim versions were not changed.",
      details: payload.errors,
    });
  }

  const existingClaims = await db.select().from(patentClaimsTable).where(eq(patentClaimsTable.patentId, patent.id));
  const currentByNumber = new Map<string, typeof patentClaimsTable.$inferSelect>();
  for (const claim of existingClaims) {
    const current = currentByNumber.get(claim.claimNumber);
    if (!current || claim.version > current.version) currentByNumber.set(claim.claimNumber, claim);
  }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, patent.projectId)).limit(1);
  if (!project) return void res.status(404).json({ error: "Patent project not found." });

  const [updatedPatent, refreshedClaims] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(monitoredPatentsTable).set({
      title: patent.verificationStatus === "MANUALLY_CORRECTED" ? patent.title : payload.title,
      applicationNumber: payload.applicationNumber,
      filingDate: payload.filingDate,
      issueDate: payload.issueDate,
      earliestPriorityDate: payload.earliestPriorityDate,
      assignee: payload.assignee,
      inventors: payload.inventors,
      abstract: payload.abstract,
      patentStatus: payload.patentStatus,
      source: payload.source,
      sourceIdentifier: payload.sourceIdentifier,
      sourceUrl: payload.sourceUrl,
      retrievalMethod: "AUTOMATIC_REFRESH",
      retrievedAt: payload.retrievedAt ? new Date(payload.retrievedAt) : new Date(),
      verificationStatus: patent.verificationStatus === "MANUALLY_CORRECTED" ? "MANUALLY_CORRECTED" : "PENDING",
    }).where(eq(monitoredPatentsTable.id, patent.id)).returning();
    const inserted = await tx.insert(patentClaimsTable).values(payload.claims.map((claim) => {
      const existing = currentByNumber.get(claim.claimNumber);
      return {
        patentId: patent.id,
        claimNumber: claim.claimNumber,
        version: (existing?.version ?? 0) + 1,
        claimText: claim.claimText,
        claimType: claim.claimType,
        dependsOnClaimNumber: claim.dependsOnClaimNumber,
        source: payload.source,
        sourceIdentifier: payload.sourceIdentifier,
        retrievedAt: payload.retrievedAt ? new Date(payload.retrievedAt) : new Date(),
        verificationStatus: "PENDING" as const,
        selectedForMonitoring: existing?.selectedForMonitoring ?? false,
        createdById: req.portalUser!.id,
      };
    })).returning();
    return [updated, inserted] as const;
  });

  res.json({ patent: serializePatent(updatedPatent, project.publicId, [...existingClaims, ...refreshedClaims]) });
});

router.patch("/portal/patents/:id/monitoring", async (req, res) => {
  const patentPublicId = publicIdOf(req.params.id);
  const patent = patentPublicId ? await patentProject(req.portalUser!, patentPublicId) : null;
  if (!patent) return void res.status(404).json({ error: "Patent not found." });
  if (typeof req.body?.active !== "boolean") return void res.status(400).json({ error: "Monitoring active state is required." });
  const [updated] = await db.update(monitoredPatentsTable)
    .set({ monitoringActive: req.body.active })
    .where(eq(monitoredPatentsTable.id, patent.id))
    .returning();
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, updated.projectId)).limit(1);
  res.json({ patent: serializePatent(updated, project!.publicId, []) });
});

router.post("/portal/projects/:id/patents", async (req, res) => {
  const projectPublicId = publicIdOf(req.params.id);
  const project = projectPublicId ? await accessibleProject(req.portalUser!, projectPublicId) : null;
  const patentNumber = normalizePatentNumbers(text(req.body?.patentNumber))[0] ?? "";
  const title = text(req.body?.title);
  if (!project) return void res.status(404).json({ error: "Project not found." });
  if (req.portalUser!.role === "CLIENT") return void res.status(403).json({ error: "Manual patent correction requires an attorney or administrator." });
  if (!patentNumber || !title) return void res.status(400).json({ error: "Patent number and title are required." });
  const [existing] = await db.select({ publicId: monitoredPatentsTable.publicId })
    .from(monitoredPatentsTable)
    .where(and(eq(monitoredPatentsTable.projectId, project.id), eq(monitoredPatentsTable.patentNumber, patentNumber)))
    .limit(1);
  if (existing) return void res.status(409).json({ error: "This patent is already being monitored in this project.", patentId: existing.publicId });
  const manualClaims = Array.isArray(req.body?.claims) ? req.body.claims : [];
  const [patent, claims] = await db.transaction(async (tx) => {
    const [createdPatent] = await tx.insert(monitoredPatentsTable).values({
      projectId: project.id,
      patentNumber,
      title,
      applicationNumber: text(req.body?.applicationNumber) || null,
      filingDate: text(req.body?.filingDate) || null,
      issueDate: text(req.body?.issueDate) || null,
      earliestPriorityDate: text(req.body?.earliestPriorityDate) || null,
      assignee: text(req.body?.assignee) || null,
      inventors: Array.isArray(req.body?.inventors) ? req.body.inventors.filter((item: unknown): item is string => typeof item === "string") : [],
      abstract: text(req.body?.abstract) || null,
      patentStatus: text(req.body?.patentStatus) || "MANUALLY_ENTERED",
      jurisdiction: text(req.body?.jurisdiction) || "US",
      sourceUrl: text(req.body?.sourceUrl) || null,
      source: "MANUAL",
      sourceIdentifier: patentNumber,
      retrievalMethod: "MANUAL",
      verificationStatus: "MANUALLY_CORRECTED",
      monitoringActive: true,
      createdById: req.portalUser!.id,
    }).returning();
    const createdClaims = manualClaims.length
      ? await tx.insert(patentClaimsTable).values(manualClaims
          .filter((claim: unknown) => {
            const item = claim as Record<string, unknown>;
            return text(item.claimNumber) && text(item.claimText);
          })
          .map((claim: unknown) => {
            const item = claim as Record<string, unknown>;
            const claimType = item.claimType === "INDEPENDENT" || item.claimType === "DEPENDENT" ? item.claimType : "UNKNOWN";
            return {
              patentId: createdPatent.id,
              claimNumber: text(item.claimNumber),
              claimText: text(item.claimText),
              claimType,
              dependsOnClaimNumber: text(item.dependsOnClaimNumber) || null,
              source: "MANUAL",
              sourceIdentifier: patentNumber,
              verificationStatus: "MANUALLY_CORRECTED" as const,
              selectedForMonitoring: item.selectedForMonitoring === true,
              createdById: req.portalUser!.id,
            };
          })).returning()
      : [];
    return [createdPatent, createdClaims] as const;
  });
  res.status(201).json({ patent: serializePatent(patent, project.publicId, claims) });
});

router.post("/portal/patents/:id/claims", async (req, res) => {
  const patentPublicId = publicIdOf(req.params.id);
  const patent = patentPublicId ? await patentProject(req.portalUser!, patentPublicId) : null;
  const claimNumber = text(req.body?.claimNumber);
  const claimText = text(req.body?.claimText);
  const version = Number(req.body?.version ?? 1);
  if (!patent) return void res.status(404).json({ error: "Patent not found." });
  if (!claimNumber || !claimText || !validId(version)) return void res.status(400).json({ error: "Claim number, text, and a positive version are required." });
  const [claim] = await db.insert(patentClaimsTable).values({
    patentId: patent.id,
    claimNumber,
    claimText,
    version,
    claimType: req.body?.claimType === "INDEPENDENT" || req.body?.claimType === "DEPENDENT" ? req.body.claimType : "UNKNOWN",
    dependsOnClaimNumber: text(req.body?.dependsOnClaimNumber) || null,
    source: "MANUAL",
    sourceIdentifier: patent.patentNumber,
    verificationStatus: "MANUALLY_CORRECTED",
    selectedForMonitoring: req.body?.selectedForMonitoring === true,
    createdById: req.portalUser!.id,
  }).returning();
  res.status(201).json({ claim: serializeClaim(claim, patent.publicId) });
});

router.post("/portal/projects/:id/workspace-items", async (req, res) => {
  const projectPublicId = publicIdOf(req.params.id);
  const project = projectPublicId ? await accessibleProject(req.portalUser!, projectPublicId) : null;
  const nextClassification = classification(req.body?.classification);
  if (!project) return void res.status(404).json({ error: "Project not found." });
  if (!text(req.body?.title) || !text(req.body?.itemType) || !nextClassification) return void res.status(400).json({ error: "Title, item type, and classification are required." });
  if (req.portalUser!.role === "CLIENT" && nextClassification === "ATTORNEY_WORK_PRODUCT") {
    return void res.status(403).json({ error: "Clients cannot create attorney work product." });
  }
  const [item] = await db.insert(projectWorkspaceItemsTable).values({
    projectId: project.id,
    title: text(req.body.title),
    itemType: text(req.body.itemType),
    content: typeof req.body?.content === "string" ? req.body.content : "",
    sourceUrl: text(req.body?.sourceUrl) || null,
    classification: nextClassification,
    createdById: req.portalUser!.id,
  }).returning();
  res.status(201).json({ item: serializeWorkspaceItem(item, project.publicId) });
});

router.post("/portal/projects/:id/analysis-runs", async (req, res) => {
  const projectPublicId = publicIdOf(req.params.id);
  const project = projectPublicId ? await accessibleProject(req.portalUser!, projectPublicId) : null;
  if (!project) return void res.status(404).json({ error: "Project not found." });
  const projectId = project.id;
  const [config] = await db.select().from(projectAiConfigsTable).where(eq(projectAiConfigsTable.projectId, projectId)).limit(1);
  const selectedProvider = config?.selectedProvider ?? "MANUAL";
  if (selectedProvider !== "MANUAL") {
    return void res.status(409).json({ error: "The selected external processing environment is not connected. No data was transferred." });
  }
  const nextTriage = triage(req.body?.triage);
  const summary = text(req.body?.summary);
  if (!nextTriage || !summary) return void res.status(400).json({ error: "Triage and summary are required." });
  const patentPublicId = req.body?.patentId === undefined ? "" : publicIdOf(req.body?.patentId);
  const claimPublicId = req.body?.claimId === undefined ? "" : publicIdOf(req.body?.claimId);
  const [patent] = patentPublicId
    ? await db.select().from(monitoredPatentsTable).where(and(eq(monitoredPatentsTable.publicId, patentPublicId), eq(monitoredPatentsTable.projectId, projectId))).limit(1)
    : [];
  if (req.body?.patentId !== undefined && !patent) return void res.status(404).json({ error: "Patent not found in this project." });
  const [claim] = claimPublicId
    ? await db.select().from(patentClaimsTable).where(eq(patentClaimsTable.publicId, claimPublicId)).limit(1)
    : [];
  if (req.body?.claimId !== undefined && (!claim || !patent || claim.patentId !== patent.id)) {
    return void res.status(404).json({ error: "Claim not found in this project." });
  }
  const [run] = await db.insert(analysisRunsTable).values({
    projectId,
    patentId: patent?.id ?? null,
    claimId: claim?.id ?? null,
    provider: "MANUAL",
    triage: nextTriage,
    summary,
    limitationAnalysis: jsonArray(req.body?.limitationAnalysis),
    evidence: jsonArray(req.body?.evidence),
    inputProvenance: jsonObject(req.body?.inputProvenance),
    providerProvenance: { mode: "manual", submittedByRole: req.portalUser!.role },
    createdById: req.portalUser!.id,
  }).returning();
  res.status(201).json({
    run: serializeRun(
      run,
      project.publicId,
      patent ? new Map([[patent.id, patent.publicId]]) : new Map(),
      claim ? new Map([[claim.id, claim.publicId]]) : new Map(),
      [],
    ),
  });
});

router.post("/portal/analysis-runs/:id/reviews", async (req, res) => {
  const runPublicId = publicIdOf(req.params.id);
  const [run] = runPublicId ? await db.select().from(analysisRunsTable).where(eq(analysisRunsTable.publicId, runPublicId)).limit(1) : [];
  const [project] = run ? await db.select().from(projectsTable).where(eq(projectsTable.id, run.projectId)).limit(1) : [];
  if (!run || !project || !(await accessibleProject(req.portalUser!, project.publicId))) return void res.status(404).json({ error: "Analysis run not found." });
  const status = reviewStatus(req.body?.status);
  if (!status) return void res.status(400).json({ error: "A valid review status is required." });
  if (req.portalUser!.role === "CLIENT" && status !== "CLIENT_REVIEWED") return void res.status(403).json({ error: "Clients may only record client review." });
  const nextClassification: DataClassification = req.portalUser!.role === "CLIENT" ? "CLIENT_CONFIDENTIAL" : "ATTORNEY_WORK_PRODUCT";
  const [review] = await db.insert(analysisReviewsTable).values({
    analysisRunId: run.id,
    status,
    note: typeof req.body?.note === "string" ? req.body.note : "",
    classification: nextClassification,
    reviewerId: req.portalUser!.id,
  }).returning();
  res.status(201).json({ review: serializeReview(review, run.publicId) });
});

router.put("/portal/projects/:id/ai-config", requireAdmin, async (req, res) => {
  const projectPublicId = publicIdOf(req.params.id);
  const project = projectPublicId ? await accessibleProject(req.portalUser!, projectPublicId) : null;
  const projectId = project?.id ?? 0;
  const selectedProvider = provider(req.body?.selectedProvider);
  const allowedProviders: AiProcessingProvider[] = Array.isArray(req.body?.allowedProviders)
    ? [...new Set<AiProcessingProvider>(
        req.body.allowedProviders
          .map((item: unknown) => provider(item))
          .filter((item: AiProcessingProvider | null): item is AiProcessingProvider => item !== null),
      )]
    : [];
  if (!project) return void res.status(404).json({ error: "Project not found." });
  if (!selectedProvider || !allowedProviders.includes(selectedProvider) || !allowedProviders.includes("MANUAL")) {
    return void res.status(400).json({ error: "Allowed providers must include MANUAL and the selected provider." });
  }
  const [aiConfig] = await db.insert(projectAiConfigsTable).values({
    projectId,
    selectedProvider,
    allowedProviders,
    updatedById: req.portalUser!.id,
  }).onConflictDoUpdate({
    target: projectAiConfigsTable.projectId,
    set: { selectedProvider, allowedProviders, updatedById: req.portalUser!.id, updatedAt: new Date() },
  }).returning();
  res.json({ aiConfig: { projectId: project.publicId, selectedProvider: aiConfig.selectedProvider, allowedProviders: aiConfig.allowedProviders } });
});

export default router;