import { existsSync } from "node:fs";
import { resolve } from "node:path";

const localEnvFile = resolve(process.cwd(), "../.env.local");
if (existsSync(localEnvFile)) process.loadEnvFile(localEnvFile);

async function main() {
  const { and, asc, eq, isNull } = await import("drizzle-orm");
  const {
    db,
    pool,
    monitoredPatentsTable,
    portalUsersTable,
  } = await import("@workspace/db");
  const { isAzureConfigured, AzureStructuredOutputError } = await import("./lib/ai/azure-client");
  const { createPatentOverview } = await import("./lib/ai/patent-overview-service");

  try {
    if (!isAzureConfigured()) {
      throw new Error("Azure AI is not configured. Set the Azure environment variables before running the backfill.");
    }

    const [admin] = await db.select({ id: portalUsersTable.id }).from(portalUsersTable).where(and(
      eq(portalUsersTable.role, "ADMIN"),
      eq(portalUsersTable.active, true),
      eq(portalUsersTable.status, "ACTIVE"),
    )).orderBy(asc(portalUsersTable.id)).limit(1);
    if (!admin) throw new Error("No active ADMIN user exists to attribute backfilled overview runs.");

    const patents = await db.select().from(monitoredPatentsTable)
      .where(isNull(monitoredPatentsTable.archivedAt))
      .orderBy(asc(monitoredPatentsTable.projectId), asc(monitoredPatentsTable.id));
    let completed = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;
    console.log(`Starting overview backfill for ${patents.length} non-archived patents.`);

    for (const patent of patents) {
      try {
        const result = await createPatentOverview({
          patent,
          projectId: patent.projectId,
          createdById: admin.id,
        });
        if (result.created) {
          created += 1;
          console.log(`Created overview for patent ${patent.patentNumber} (${completed + 1}/${patents.length}).`);
        } else {
          skipped += 1;
          console.log(`Already current: patent ${patent.patentNumber} (${completed + 1}/${patents.length}).`);
        }
      } catch (error) {
        failed += 1;
        const code = error instanceof AzureStructuredOutputError
          ? error.code
          : error instanceof Error && error.message.startsWith("Patent overview")
            ? "OVERVIEW_VALIDATION_FAILED"
            : "OVERVIEW_FAILED";
        const detail = code === "OVERVIEW_VALIDATION_FAILED" && error instanceof Error
          ? `: ${error.message}`
          : error instanceof Error
            ? `: ${error.name}${error && typeof error === "object" && "code" in error ? `/${String((error as { code: unknown }).code)}` : ""}${error.stack?.split("\n")[1] ? ` ${error.stack.split("\n")[1].trim()}` : ""}`
            : "";
        console.error(`Failed patent ${patent.patentNumber} (${code}${detail}).`);
      } finally {
        completed += 1;
      }
    }

    console.log(`Overview backfill finished: ${created} created, ${skipped} skipped, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Overview backfill failed.";
  console.error(message);
  process.exitCode = 1;
});
