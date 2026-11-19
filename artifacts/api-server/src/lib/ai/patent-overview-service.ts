import { and, asc, desc, eq } from "drizzle-orm";
import {
  analysisRunsTable,
  db,
  monitoredPatentsTable,
  patentClaimsTable,
} from "@workspace/db";
import {
  buildPatentOverviewInput,
  generatePatentOverview,
  hasCurrentPatentOverviewPromptVersion,
  hasSamePatentClaimVersions,
  patentOverviewInputProvenance,
  PROMPT_VERSION,
} from "./tasks/patent-overview";
import { withPatentOverviewLock } from "./overview-lock";
import type { AzureResponsesClient } from "./azure-client";

function currentClaims(claims: (typeof patentClaimsTable.$inferSelect)[]) {
  const latest = new Map<string, typeof patentClaimsTable.$inferSelect>();
  for (const claim of claims) {
    const existing = latest.get(claim.claimNumber);
    if (!existing || claim.version > existing.version) latest.set(claim.claimNumber, claim);
  }
  return [...latest.values()].sort((a, b) => a.claimNumber.localeCompare(b.claimNumber));
}

export async function createPatentOverview(options: {
  patent: typeof monitoredPatentsTable.$inferSelect;
  projectId: number;
  createdById: number;
  client?: AzureResponsesClient;
}) {
  const claims = await db.select().from(patentClaimsTable)
    .where(eq(patentClaimsTable.patentId, options.patent.id))
    .orderBy(asc(patentClaimsTable.claimNumber), desc(patentClaimsTable.version));
  const latestClaims = currentClaims(claims);
  const snapshot = latestClaims.map((claim) => ({
    id: claim.id,
    claimNumber: claim.claimNumber,
    version: claim.version,
    selectedForMonitoring: claim.selectedForMonitoring,
  }));
  return withPatentOverviewLock(options.patent.id, snapshot, async () => {
    const input = buildPatentOverviewInput(options.patent, latestClaims);
    const inputProvenance = patentOverviewInputProvenance(input, latestClaims);
    const existingRuns = await db.select().from(analysisRunsTable).where(and(
      eq(analysisRunsTable.projectId, options.projectId),
      eq(analysisRunsTable.patentId, options.patent.id),
      eq(analysisRunsTable.analysisType, "OVERVIEW"),
    )).orderBy(desc(analysisRunsTable.createdAt));
    const matchingRun = existingRuns.find((run) => {
      const providerProvenance = run.providerProvenance as Record<string, unknown>;
      return hasCurrentPatentOverviewPromptVersion(providerProvenance.promptVersion)
        && hasSamePatentClaimVersions(
          (run.inputProvenance as Record<string, unknown>).currentClaimVersions,
          inputProvenance.currentClaimVersions,
        );
    });
    if (matchingRun) return { run: matchingRun, claims, created: false };

    const result = await generatePatentOverview({
      projectId: options.projectId,
      patentId: options.patent.id,
      input,
      prohibitedDetails: [
        { label: "patent number", value: options.patent.patentNumber },
        { label: "patent number", value: options.patent.patentNumber.replace(/\D/g, "") },
        { label: "patent title", value: options.patent.title },
        { label: "filing date", value: options.patent.filingDate ?? "" },
        { label: "issue date", value: options.patent.issueDate ?? "" },
        ...(Array.isArray(options.patent.inventors)
          ? options.patent.inventors
            .filter((inventor): inventor is string => typeof inventor === "string")
            .map((inventor) => ({ label: "inventor name", value: inventor }))
          : []),
      ],
      client: options.client,
    });
    const [run] = await db.insert(analysisRunsTable).values({
      projectId: options.projectId,
      patentId: options.patent.id,
      claimId: null,
      provider: "ZK_MANAGED_AI",
      analysisType: "OVERVIEW",
      triage: result.data.attention,
      reviewStatus: "UNREVIEWED",
      summary: result.data.summary,
      limitationAnalysis: [],
      evidence: [],
      inputProvenance,
      providerProvenance: {
        provider: "ZK_MANAGED_AI",
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
        model: result.model,
        api: "responses",
        task: "patent-overview",
        promptVersion: PROMPT_VERSION,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
        responseId: result.responseId,
        timestamp: new Date().toISOString(),
      },
      createdById: options.createdById,
    }).returning();
    await db.update(monitoredPatentsTable).set({ lastAnalyzedAt: run.createdAt })
      .where(eq(monitoredPatentsTable.id, options.patent.id));
    return { run, claims, created: true };
  });
}
