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

const router = Router();
const idOf = (value: string | string[]) => Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
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

async function accessibleProject(user: PortalUser, projectId: number) {
  const [project] = await db.select().from(projectsTable).where(and(
    eq(projectsTable.id, projectId),
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

async function patentProject(user: PortalUser, patentId: number) {
  const [patent] = await db.select().from(monitoredPatentsTable).where(eq(monitoredPatentsTable.id, patentId)).limit(1);
  if (!patent || !(await accessibleProject(user, patent.projectId))) return null;
  return patent;
}

router.use("/portal", requirePortalAccess);

router.get("/portal/projects/:id/workspace", async (req, res) => {
  const projectId = idOf(req.params.id);
  const project = validId(projectId) ? await accessibleProject(req.portalUser!, projectId) : null;
  if (!project) return void res.status(404).json({ error: "Project not found." });

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
  const [[tool], [client]] = await Promise.all([
    db.select().from(toolsTable).where(eq(toolsTable.id, project.toolId)).limit(1),
    db.select().from(clientsTable).where(eq(clientsTable.id, project.clientId)).limit(1),
  ]);

  res.json({
    project,
    tool,
    client,
    aiConfig: aiConfig ?? { projectId, selectedProvider: "MANUAL", allowedProviders: ["MANUAL"], updatedById: null, updatedAt: null },
    patents: patents.map((patent) => ({ ...patent, claims: claims.filter((claim) => claim.patentId === patent.id) })),
    workspaceItems,
    analysisRuns: analysisRuns.map((run) => ({ ...run, reviews: visibleReviews.filter((review) => review.analysisRunId === run.id) })),
  });
});

router.post("/portal/projects/:id/patents", async (req, res) => {
  const projectId = idOf(req.params.id);
  const project = validId(projectId) ? await accessibleProject(req.portalUser!, projectId) : null;
  const patentNumber = text(req.body?.patentNumber);
  const title = text(req.body?.title);
  if (!project) return void res.status(404).json({ error: "Project not found." });
  if (!patentNumber || !title) return void res.status(400).json({ error: "Patent number and title are required." });
  const [patent] = await db.insert(monitoredPatentsTable).values({
    projectId,
    patentNumber,
    title,
    jurisdiction: text(req.body?.jurisdiction) || "US",
    sourceUrl: text(req.body?.sourceUrl) || null,
    createdById: req.portalUser!.id,
  }).returning();
  res.status(201).json({ patent });
});

router.post("/portal/patents/:id/claims", async (req, res) => {
  const patentId = idOf(req.params.id);
  const patent = validId(patentId) ? await patentProject(req.portalUser!, patentId) : null;
  const claimNumber = text(req.body?.claimNumber);
  const claimText = text(req.body?.claimText);
  const version = Number(req.body?.version ?? 1);
  if (!patent) return void res.status(404).json({ error: "Patent not found." });
  if (!claimNumber || !claimText || !validId(version)) return void res.status(400).json({ error: "Claim number, text, and a positive version are required." });
  const [claim] = await db.insert(patentClaimsTable).values({
    patentId,
    claimNumber,
    claimText,
    version,
    createdById: req.portalUser!.id,
  }).returning();
  res.status(201).json({ claim });
});

router.post("/portal/projects/:id/workspace-items", async (req, res) => {
  const projectId = idOf(req.params.id);
  const project = validId(projectId) ? await accessibleProject(req.portalUser!, projectId) : null;
  const nextClassification = classification(req.body?.classification);
  if (!project) return void res.status(404).json({ error: "Project not found." });
  if (!text(req.body?.title) || !text(req.body?.itemType) || !nextClassification) return void res.status(400).json({ error: "Title, item type, and classification are required." });
  if (req.portalUser!.role === "CLIENT" && nextClassification === "ATTORNEY_WORK_PRODUCT") {
    return void res.status(403).json({ error: "Clients cannot create attorney work product." });
  }
  const [item] = await db.insert(projectWorkspaceItemsTable).values({
    projectId,
    title: text(req.body.title),
    itemType: text(req.body.itemType),
    content: typeof req.body?.content === "string" ? req.body.content : "",
    sourceUrl: text(req.body?.sourceUrl) || null,
    classification: nextClassification,
    createdById: req.portalUser!.id,
  }).returning();
  res.status(201).json({ item });
});

router.post("/portal/projects/:id/analysis-runs", async (req, res) => {
  const projectId = idOf(req.params.id);
  const project = validId(projectId) ? await accessibleProject(req.portalUser!, projectId) : null;
  if (!project) return void res.status(404).json({ error: "Project not found." });
  const [config] = await db.select().from(projectAiConfigsTable).where(eq(projectAiConfigsTable.projectId, projectId)).limit(1);
  const selectedProvider = config?.selectedProvider ?? "MANUAL";
  if (selectedProvider !== "MANUAL") {
    return void res.status(409).json({ error: "The selected external processing environment is not connected. No data was transferred." });
  }
  const nextTriage = triage(req.body?.triage);
  const summary = text(req.body?.summary);
  if (!nextTriage || !summary) return void res.status(400).json({ error: "Triage and summary are required." });
  const patentId = Number(req.body?.patentId);
  const claimId = Number(req.body?.claimId);
  const [run] = await db.insert(analysisRunsTable).values({
    projectId,
    patentId: validId(patentId) ? patentId : null,
    claimId: validId(claimId) ? claimId : null,
    provider: "MANUAL",
    triage: nextTriage,
    summary,
    limitationAnalysis: jsonArray(req.body?.limitationAnalysis),
    evidence: jsonArray(req.body?.evidence),
    inputProvenance: jsonObject(req.body?.inputProvenance),
    providerProvenance: { mode: "manual", submittedByRole: req.portalUser!.role },
    createdById: req.portalUser!.id,
  }).returning();
  res.status(201).json({ run });
});

router.post("/portal/analysis-runs/:id/reviews", async (req, res) => {
  const runId = idOf(req.params.id);
  const [run] = validId(runId) ? await db.select().from(analysisRunsTable).where(eq(analysisRunsTable.id, runId)).limit(1) : [];
  if (!run || !(await accessibleProject(req.portalUser!, run.projectId))) return void res.status(404).json({ error: "Analysis run not found." });
  const status = reviewStatus(req.body?.status);
  if (!status) return void res.status(400).json({ error: "A valid review status is required." });
  if (req.portalUser!.role === "CLIENT" && status !== "CLIENT_REVIEWED") return void res.status(403).json({ error: "Clients may only record client review." });
  const nextClassification: DataClassification = req.portalUser!.role === "CLIENT" ? "CLIENT_CONFIDENTIAL" : "ATTORNEY_WORK_PRODUCT";
  const [review] = await db.insert(analysisReviewsTable).values({
    analysisRunId: runId,
    status,
    note: typeof req.body?.note === "string" ? req.body.note : "",
    classification: nextClassification,
    reviewerId: req.portalUser!.id,
  }).returning();
  res.status(201).json({ review });
});

router.put("/portal/projects/:id/ai-config", requireAdmin, async (req, res) => {
  const projectId = idOf(req.params.id);
  const project = validId(projectId) ? await accessibleProject(req.portalUser!, projectId) : null;
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
  res.json({ aiConfig });
});

export default router;