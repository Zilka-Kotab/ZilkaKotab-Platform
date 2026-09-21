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
    createdAt: claim.createdAt,
  };
}

function serializePatent(patent: typeof monitoredPatentsTable.$inferSelect, projectPublicId: string, claims: typeof patentClaimsTable.$inferSelect[]) {
  return {
    publicId: patent.publicId,
    projectId: projectPublicId,
    patentNumber: patent.patentNumber,
    title: patent.title,
    jurisdiction: patent.jurisdiction,
    sourceUrl: patent.sourceUrl,
    createdAt: patent.createdAt,
    claims: claims.map((claim) => serializeClaim(claim, patent.publicId)),
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

router.post("/portal/projects/:id/patents", async (req, res) => {
  const projectPublicId = publicIdOf(req.params.id);
  const project = projectPublicId ? await accessibleProject(req.portalUser!, projectPublicId) : null;
  const patentNumber = text(req.body?.patentNumber);
  const title = text(req.body?.title);
  if (!project) return void res.status(404).json({ error: "Project not found." });
  if (!patentNumber || !title) return void res.status(400).json({ error: "Patent number and title are required." });
  const [patent] = await db.insert(monitoredPatentsTable).values({
    projectId: project.id,
    patentNumber,
    title,
    jurisdiction: text(req.body?.jurisdiction) || "US",
    sourceUrl: text(req.body?.sourceUrl) || null,
    createdById: req.portalUser!.id,
  }).returning();
  res.status(201).json({ patent: serializePatent(patent, project.publicId, []) });
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