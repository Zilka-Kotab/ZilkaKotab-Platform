import { db, pool, firmBenchmarkApplicationsTable, firmBenchmarkRefreshTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { FIRM_CUSTOMER_NUMBERS } from "./firm-benchmark-math";
import { metricApplication, type MetricApplication } from "./portfolio-metrics";

const WEEK = 7 * 86400000;
let cached: { expires: number; records: MetricApplication[]; updatedAt: string | null } | null = null;
export async function firmSnapshot() {
  if (cached && cached.expires > Date.now()) return cached;
  const snapshot = await db.transaction(async tx => {
    const [status] = await tx.select().from(firmBenchmarkRefreshTable).where(eq(firmBenchmarkRefreshTable.id, 1));
    const rows = status?.completedAt ? await tx.select().from(firmBenchmarkApplicationsTable) : [];
    return { records: rows.map(r => r.record as MetricApplication), updatedAt: status?.completedAt?.toISOString() ?? null };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
  cached = { expires: Date.now() + 60000, ...snapshot };
  return cached;
}
export async function firmRefreshStatus() {
  const [r] = await db.select().from(firmBenchmarkRefreshTable).where(eq(firmBenchmarkRefreshTable.id, 1));
  return {
    state: r?.state ?? "idle", applicationCount: r?.applicationCount ?? 0,
    completedCustomerNumbers: r?.completedCustomerNumbers ?? 0, totalCustomerNumbers: FIRM_CUSTOMER_NUMBERS.length,
    startedAt: r?.startedAt?.toISOString() ?? null, completedAt: r?.completedAt?.toISOString() ?? null,
    error: r?.error ?? null,
  };
}
/** Dedicated connection holds an advisory lock across the background job, not a public request. */
export async function startFirmRefresh() {
  const client = await pool.connect();
  const lock = await client.query("SELECT pg_try_advisory_lock(58317239) AS locked");
  if (!lock.rows[0].locked) { client.release(); return false; }
  try {
    await db.insert(firmBenchmarkRefreshTable).values({ id: 1, state: "running", startedAt: new Date(), completedCustomerNumbers: 0, error: null })
      .onConflictDoUpdate({ target: firmBenchmarkRefreshTable.id, set: { state: "running", startedAt: new Date(), completedCustomerNumbers: 0, error: null } });
  } catch (err) {
    await client.query("SELECT pg_advisory_unlock(58317239)"); client.release(); throw err;
  }
  void (async () => {
    try {
      // Import only when running: public analysis uses the cached DB snapshot, never this pull.
      const { fetchFirmApplicationPage } = await import("./public-patent-tools");
      const records = new Map<string, MetricApplication>();
      let completed = 0;
      for (const customer of FIRM_CUSTOMER_NUMBERS) {
        let offset = 0, total = Infinity;
        const seen = new Set<string>();
        while (offset < total) {
          const page = await fetchFirmApplicationPage(customer, offset);
          if (Number.isFinite(total) && page.count !== total) throw new Error("USPTO result count changed during refresh; previous dataset retained.");
          total = page.count;
          if (!page.records.length && offset < total) throw new Error("USPTO pagination ended before the reported total.");
          for (const raw of page.records) {
            const r = metricApplication(raw);
            if (!r.applicationNumber || !r.customerNumbers.includes(customer)) {
              throw new Error("USPTO returned an application without the requested correspondence customer number.");
            }
            if (seen.has(r.applicationNumber)) throw new Error("USPTO pagination repeated an application; previous dataset retained.");
            seen.add(r.applicationNumber);
            records.set(r.applicationNumber, r);
          }
          offset += page.records.length;
        }
        await db.update(firmBenchmarkRefreshTable).set({ completedCustomerNumbers: ++completed }).where(eq(firmBenchmarkRefreshTable.id, 1));
      }
      if (!records.size) throw new Error("USPTO returned no firm applications; the previous dataset was retained.");
      // Publish a complete generation atomically. Failed/partial pulls never replace good data.
      await db.transaction(async tx => {
        await tx.delete(firmBenchmarkApplicationsTable);
        const all = [...records.values()];
        for (let i = 0; i < all.length; i += 250) {
          await tx.insert(firmBenchmarkApplicationsTable).values(all.slice(i, i + 250).map(record => ({
            applicationNumber: record.applicationNumber, record,
          })));
        }
        await tx.update(firmBenchmarkRefreshTable).set({ state: "ready", completedAt: new Date(), applicationCount: records.size, error: null })
          .where(eq(firmBenchmarkRefreshTable.id, 1));
      });
      cached = null;
      logger.info({ applications: records.size }, "Firm benchmark dataset refreshed");
    } catch (err) {
      logger.error({ err }, "Firm benchmark refresh failed; previous dataset retained");
      await db.update(firmBenchmarkRefreshTable).set({ state: "failed", error: err instanceof Error ? err.message.slice(0, 500) : "Refresh failed" })
        .where(eq(firmBenchmarkRefreshTable.id, 1));
    } finally {
      await client.query("SELECT pg_advisory_unlock(58317239)").catch(() => {});
      client.release();
    }
  })().catch(err => logger.error({ err }, "Firm benchmark job cleanup failed"));
  return true;
}
export function scheduleFirmRefresh() {
  const check = async () => {
    try {
      const s = await firmRefreshStatus();
      if (s.completedAt && Date.now() - +new Date(s.completedAt) < WEEK) return;
      if (s.startedAt && Date.now() - +new Date(s.startedAt) < 3600000) return;
      await startFirmRefresh();
    } catch (err) { logger.error({ err }, "Could not schedule firm benchmark refresh"); }
  };
  void check();
  setInterval(() => void check(), 3600000).unref();
}
