import { createHash } from "node:crypto";
import { pool } from "@workspace/db";
import type { PublicExaminerRceContinuation, PublicExaminerBehaviorMetric } from "@workspace/api-zod";
import { logger } from "./logger";
import { applicationId, parseRceTransactions, fetchRceEvidence, fetchContinuationEvidence, RCE_CALCULATION_VERSION, type Evidence, type UsptoFetch, type JsonRecord } from "./examiner-rce-evidence";

type Cohort = { ids: string[]; dates: Record<string, string> };
type Job = { id: string; cohort: Cohort; cutoff: string; excluded: number; state: PublicExaminerRceContinuation["state"]; updated_at: Date };
type CacheRow = { application_number: string; tx: Evidence | null; continuity: Evidence | null };
let schema: Promise<unknown> | undefined;
const init = () => schema ??= pool.query(`
  CREATE TABLE IF NOT EXISTS examiner_application_evidence (
    application_number text PRIMARY KEY, tx jsonb, continuity jsonb
  );
  CREATE TABLE IF NOT EXISTS examiner_rate_jobs (
    id text PRIMARY KEY, examiner_name text NOT NULL, cohort jsonb NOT NULL,
    cutoff text NOT NULL, excluded integer NOT NULL, state text NOT NULL DEFAULT 'queued',
    calculation_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`).catch(error => { schema = undefined; throw error; });

export function matureExaminerCohort(records: JsonRecord[], now = new Date()) {
  const year = now.getUTCFullYear() - 2, month = now.getUTCMonth();
  const cutoff = new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate()))).toISOString().slice(0, 10);
  const all = new Map<string, JsonRecord>();
  const dates: Record<string, string> = {};
  for (const record of records) {
    const id = applicationId(record.applicationNumberText);
    if (!/^\d{8}$/.test(id)) continue;
    all.set(id, record);
    const meta = record.applicationMetaData as JsonRecord | undefined;
    const date = meta?.filingDate;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date) dates[id] = date;
  }
  const ids = [...all].filter(([id, record]) => {
    const meta = record.applicationMetaData as JsonRecord | undefined;
    return meta?.applicationTypeCategory === "REGULAR" && !/design|provisional|PCT/i.test(String(meta.applicationTypeLabelName ?? ""))
      && dates[id] >= "2001-01-01" && dates[id] <= cutoff;
  }).map(([id]) => id).sort();
  return { cohort: { ids, dates }, cutoff, excluded: all.size - ids.length, records: all };
}
function fresh(e: Evidence | null | undefined) {
  return e && e.version === RCE_CALCULATION_VERSION && Date.parse(e.expiresAt) > Date.now() ? e : null;
}
function known(e: Evidence | null | undefined) { return e?.state === "yes" || e?.state === "no"; }
async function cachedRows(ids: string[]) {
  const rows = await pool.query<CacheRow>("SELECT * FROM examiner_application_evidence WHERE application_number = ANY($1::text[])", [ids]);
  return new Map(rows.rows.map(r => [r.application_number, { tx: fresh(r.tx), continuity: fresh(r.continuity) }]));
}
async function put(id: string, kind: "tx" | "continuity", data: Evidence) {
  // kind is a closed internal union, never a request-controlled SQL identifier.
  await pool.query(`INSERT INTO examiner_application_evidence(application_number,${kind}) VALUES($1,$2::jsonb)
    ON CONFLICT(application_number) DO UPDATE SET ${kind}=EXCLUDED.${kind}`, [id, JSON.stringify(data)]);
}
export async function saveApplicationEvidence(id: string, kind: "tx" | "continuity", data: Evidence) {
  await init(); await put(id, kind, data);
}
export function calculateIndependentExaminerRate(job: Job, rows: Map<string, { tx: Evidence | null; continuity: Evidence | null }>, kind: "tx" | "continuity"): PublicExaminerBehaviorMetric {
  const evidence = job.cohort.ids.map(id => rows.get(id)?.[kind]);
  const numerator = evidence.filter(e => e?.state === "yes").length;
  const unresolved = evidence.filter(e => !known(e)).length;
  const dates = evidence.filter((e): e is Evidence => Boolean(e)).map(e => e.retrievedAt).sort();
  const sourceDate = dates.length ? `${dates[0]} to ${dates.at(-1)}` : "not retrieved";
  const problems = [...new Set(evidence.filter(e => e && !known(e)).map(e => e!.note))].slice(0, 2).join(" ");
  return {
    rate: !unresolved && evidence.length >= 10 ? Math.round(numerator / evidence.length * 1000) / 10 : null,
    numerator, denominator: evidence.length,
    note: `${kind === "tx"
      ? "Percentage of eligible applications with at least one Request for Continued Examination. Multiple RCE filings in the same application count only once."
      : "Percentage of eligible parent applications with at least one subsequently filed continuation application. Excludes divisionals and continuations-in-part."}
      ${numerator} of ${evidence.length}; ${unresolved} unresolved. Sources retrieved: ${sourceDate}. Calculation: ${RCE_CALCULATION_VERSION}.
      ${problems} ${unresolved ? "N/A until all eligible outcomes are resolved; failures never count as negatives." : evidence.length < 10 ? "N/A: fewer than 10 eligible applications." : ""}
      ${kind === "continuity" ? "Continuity uses dedicated endpoint data and, when necessary, a reverse parent index. Unpublished children may not yet be visible." : "Transaction evidence is reused from complete non-empty Search event histories; ambiguous histories are checked against dedicated transactions/documents."}`,
  };
}
export async function getExaminerRateJob(id: string, get: UsptoFetch): Promise<PublicExaminerRceContinuation | null> {
  await init();
  const result = await pool.query<Job>("SELECT id,cohort,cutoff,excluded,state,updated_at FROM examiner_rate_jobs WHERE id=$1 AND calculation_version=$2", [id, RCE_CALCULATION_VERSION]);
  const job = result.rows[0];
  if (!job) return null;
  const rows = await cachedRows(job.cohort.ids);
  const unresolved = job.cohort.ids.some(app => !fresh(rows.get(app)?.tx) || !fresh(rows.get(app)?.continuity));
  const complete = job.cohort.ids.filter(app => known(rows.get(app)?.tx) && known(rows.get(app)?.continuity)).length;
  const paused = job.state === "partial" && Date.now() - +job.updated_at < 300000;
  const state = paused ? "partial" : unresolved ? job.state === "running" ? "running" : "queued" : complete === job.cohort.ids.length ? "complete" : "partial";
  if (unresolved && !paused) kick(id, get);
  const dates = [...rows.values()].flatMap(r => [r.tx?.retrievedAt, r.continuity?.retrievedAt]).filter((date): date is string => Boolean(date)).sort();
  return {
    id, state, calculationVersion: RCE_CALCULATION_VERSION, cohortCutoff: job.cutoff,
    eligibleApplications: job.cohort.ids.length, excludedApplications: job.excluded, completedApplications: complete,
    retrievedAt: dates.at(-1) ?? null, rce: calculateIndependentExaminerRate(job, rows, "tx"), continuation: calculateIndependentExaminerRate(job, rows, "continuity"),
    note: `Same mature filing cohort for both rates: regular non-provisional public applications filed on/after 2001-01-01 and on/before ${job.cutoff} (at least 24 calendar months old at analysis); pending and disposed applications included. ${job.excluded} records excluded for age, category, or missing/invalid filing dates. The cohort is the selected examiner's analyzed records, not all lifetime cases. Unknowns and API errors are never negative outcomes. Failed/incomplete evidence is cached for five minutes before retry; confirmed evidence refreshes after seven days. Background work resumes from persistent evidence if interrupted. Current assignment does not prove personal authorship of all transactions.`,
  };
}

export async function queueExaminerRateJob(name: string, records: JsonRecord[], get: UsptoFetch) {
  await init();
  const { cohort, cutoff, excluded, records: all } = matureExaminerCohort(records);
  const id = createHash("sha256").update(JSON.stringify([RCE_CALCULATION_VERSION, name, cutoff, cohort.ids])).digest("hex");
  await pool.query(`INSERT INTO examiner_rate_jobs(id,examiner_name,cohort,cutoff,excluded,calculation_version)
    VALUES($1,$2,$3::jsonb,$4,$5,$6) ON CONFLICT(id) DO NOTHING`, [id, name, JSON.stringify(cohort), cutoff, excluded, RCE_CALCULATION_VERSION]);
  const cached = await cachedRows(cohort.ids);
  // Reuse the complete, non-empty transaction bags already returned by ODP.
  // Only validated unambiguous results seed the cache; uncertain data is fetched.
  const seeds: { id: string; data: Evidence }[] = [];
  for (const app of cohort.ids) {
    if (known(cached.get(app)?.tx)) continue;
    const parsed = parseRceTransactions(app, all.get(app)?.eventDataBag, `https://api.uspto.gov/api/v1/patent/applications/search?q=applicationNumberText:${app}&fields=eventDataBag`);
    if (known(parsed)) seeds.push({ id: app, data: parsed });
  }
  if (seeds.length) await pool.query(`INSERT INTO examiner_application_evidence(application_number,tx)
    SELECT x.id,x.data FROM jsonb_to_recordset($1::jsonb) AS x(id text,data jsonb)
    ON CONFLICT(application_number) DO UPDATE SET tx=EXCLUDED.tx`, [JSON.stringify(seeds)]);
  kick(id, get);
  return id;
}

const pending = new Map<string, UsptoFetch>();
let working = false;
function kick(id: string, get: UsptoFetch) {
  pending.set(id, get);
  if (!working) { working = true; void drain(); }
}
async function drain() {
  try {
    while (pending.size) {
      const [id, get] = pending.entries().next().value!;
      pending.delete(id);
      const client = await pool.connect();
      let locked = false;
      try {
        locked = (await client.query("SELECT pg_try_advisory_lock(58317240) AS locked")).rows[0].locked;
        if (!locked) continue;
        const result = await pool.query<Job>("SELECT id,cohort,cutoff,excluded,state FROM examiner_rate_jobs WHERE id=$1", [id]);
        const job = result.rows[0]; if (!job) continue;
        const rows = await cachedRows(job.cohort.ids);
        const needs = job.cohort.ids.filter(app => !rows.get(app)?.tx || !rows.get(app)?.continuity);
        await pool.query("UPDATE examiner_rate_jobs SET state='running',updated_at=now() WHERE id=$1", [id]);
        const batch = needs.slice(0, 20);
        let cursor = 0, failures = 0;
        await Promise.all(Array.from({ length: 3 }, async () => {
          while (cursor < batch.length && failures < 3) {
            const app = batch[cursor++], row = rows.get(app);
            if (!row?.tx) {
              const tx = await fetchRceEvidence(app, get); if (tx.state === "error") failures++;
              await put(app, "tx", tx);
            }
            if (!row?.continuity) {
              const continuity = await fetchContinuationEvidence(app, get, job.cohort.dates); if (continuity.state === "error") failures++;
              await put(app, "continuity", continuity);
            }
          }
        }));
        if (failures >= 3) {
          pending.delete(id);
          await pool.query("UPDATE examiner_rate_jobs SET state='partial',updated_at=now() WHERE id=$1", [id]);
        } else if (needs.length > batch.length) pending.set(id, get);
        else await pool.query("UPDATE examiner_rate_jobs SET state='complete',updated_at=now() WHERE id=$1", [id]);
      } catch (error) {
        logger.error({ err: error, analysisId: id }, "Examiner RCE/continuation background batch failed");
        await pool.query("UPDATE examiner_rate_jobs SET state='partial',updated_at=now() WHERE id=$1", [id]).catch(() => {});
      } finally {
        if (locked) await client.query("SELECT pg_advisory_unlock(58317240)").catch(() => {});
        client.release();
      }
      // Give another instance's queued job a fair chance at the shared lock.
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } catch (error) { logger.error({ err: error }, "Examiner evidence worker failed"); }
  finally { working = false; }
}
