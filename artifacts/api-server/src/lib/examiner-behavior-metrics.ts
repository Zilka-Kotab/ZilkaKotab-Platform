import type { PublicExaminerBehaviorMetric } from "@workspace/api-zod";

type RecordData = Record<string, unknown>;
const object = (value: unknown): RecordData => value && typeof value === "object" ? value as RecordData : {};
const code = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase() : "";
const appId = (value: unknown) => typeof value === "string" ? value.replace(/\D/g, "") : "";
const percent = (n: number, d: number) => Math.round(n / d * 1000) / 10;
const mailCodes = new Set(["MCTNF", "MCTFR", "MCTRS"]);

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function continuationState(record: RecordData, id: string): boolean | null {
  if (!Array.isArray(record.childContinuityBag)) return null;
  let hasContinuation = false;
  let unknown = false;
  for (const raw of record.childContinuityBag) {
    const relation = object(raw);
    const child = appId(relation.childApplicationNumberText);
    const kind = code(relation.claimParentageTypeCode);
    if (appId(relation.parentApplicationNumberText) !== id || !child || child === id) { unknown = true; continue; }
    // Do not conflate divisionals or continuation-in-part children with a CON.
    if (kind === "CON") hasContinuation = true;
    else if (!["DIV", "CIP"].includes(kind)) unknown = true;
  }
  return hasContinuation ? true : unknown ? null : false;
}

export function calculateExaminerBehaviorMetrics(records: RecordData[], retrievedAt = new Date()) {
  const unique = [...new Map(records.map(record => [appId(record.applicationNumberText), record])).entries()]
    .filter(([id]) => Boolean(id));
  let eligible = 0, rce = 0, continuation = 0, combined = 0, unknownRelationships = 0;
  let quarterEnd = 0, undated = 0;
  const mailed = new Set<string>();
  const mailingDates: string[] = [];
  for (const [id, record] of unique) {
    const history = Array.isArray(record.eventDataBag) ? record.eventDataBag.map(object).filter(event => code(event.eventCode)) : [];
    if (!history.length) continue;
    eligible++;
    const hasRce = history.some(event => code(event.eventCode) === "RCEX");
    const childState = continuationState(record, id);
    if (hasRce) rce++;
    if (childState === true) continuation++;
    if (hasRce || childState === true) combined++;
    else if (childState === null) unknownRelationships++;
    for (const event of history) {
      const eventCode = code(event.eventCode);
      if (!mailCodes.has(eventCode)) continue;
      const date = validDate(event.eventDate);
      if (!date || date > retrievedAt) { undated++; continue; }
      const key = `${id}:${eventCode}:${event.eventDate}`;
      if (mailed.has(key)) continue;
      mailed.add(key);
      mailingDates.push(event.eventDate as string);
      const month = date.getUTCMonth();
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
      if ([2, 5, 8, 11].includes(month) && date.getUTCDate() >= lastDay - 13) quarterEnd++;
    }
  }
  mailingDates.sort();
  const continuationRce: PublicExaminerBehaviorMetric = {
    rate: eligible >= 10 && unknownRelationships === 0 ? percent(combined, eligible) : null,
    numerator: combined, denominator: eligible,
    note: `Distinct applications with a recorded CON child or at least one RCEX event, divided by ${eligible} distinct applications with non-empty event histories, including pending cases. Recorded RCEs: ${rce}; documented continuation parents: ${continuation}; union: ${combined} (applications with both count once). An RCE is not a separate continuation application; DIV and CIP children are excluded. ${unknownRelationships} applications have insufficient child-relationship evidence to establish the union outcome. Missing continuity data is not treated as no continuation. ${unknownRelationships ? "Combined rate withheld until relationship coverage is sufficient." : eligible < 10 ? "Rate withheld: fewer than 10 eligible applications." : ""}`,
  };
  const quarterEndConcentration: PublicExaminerBehaviorMetric = {
    rate: mailed.size >= 10 ? percent(quarterEnd, mailed.size) : null,
    numerator: quarterEnd, denominator: mailed.size,
    note: `Percentage of ${mailed.size} unique, dated USPTO mailing events (MCTNF, MCTFR, MCTRS) in the final 14 calendar days of March, June, September, or December. Deduplicated by application, mailing code, and date; internal CTNF/CTFR actions and applicant responses are not counted again. ${undated} events with missing, invalid, or future dates excluded. ${mailingDates.length ? `Observed mailing period: ${mailingDates[0]} to ${mailingDates.at(-1)}.` : "No qualifying dated mailing events."} Current application assignments do not prove the selected examiner personally issued every historical action. This is a raw calendar concentration, not a business-day-normalized index.${mailed.size < 10 ? " Rate withheld: fewer than 10 dated mailings." : ""}`,
  };
  return { continuationRce, quarterEndConcentration };
}
