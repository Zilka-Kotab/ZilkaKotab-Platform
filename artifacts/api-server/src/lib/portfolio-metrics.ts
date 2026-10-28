export type MetricApplication = {
  applicationNumber: string; filingDate: string | null; grantDate: string | null;
  artUnit: string | null; technologyCenter: string | null; status: string; applicant: string; category: string;
  customerNumbers: number[]; hasHistory: boolean; officeActions: number; rce: boolean; interview: boolean;
  eventCounts: Record<"CTNF" | "CTFR" | "RCEX" | "EXIN" | "EXAT" | "EXET", number>;
  granted: boolean; allowed: boolean; allowedInHistory: boolean; abandoned: boolean;
};
type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => v && typeof v === "object" ? v as Raw : {};
const arr = (v: unknown): Raw[] => Array.isArray(v) ? v.map(obj) : [];
const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
export const validDate = (v: unknown): string | null => {
  const s = str(v).slice(0, 10);
  const d = new Date(`${s}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(+d) && d.toISOString().slice(0, 10) === s ? s : null;
};
export function metricApplication(record: Raw): MetricApplication {
  const m = obj(record.applicationMetaData);
  const status = str(m.applicationStatusDescriptionText);
  const events = arr(record.eventDataBag);
  const eventCounts = { CTNF: 0, CTFR: 0, RCEX: 0, EXIN: 0, EXAT: 0, EXET: 0 };
  for (const event of events) {
    const code = str(event.eventCode);
    if (code in eventCounts) eventCounts[code as keyof typeof eventCounts]++;
  }
  const granted = Boolean(str(m.patentNumber) || str(m.grantDate)) || /patented case/i.test(status);
  const abandoned = /abandon/i.test(status);
  const allowed = !abandoned && (granted || /notice of allowance|allowed|issue fee payment verified|issue fee payment received/i.test(status));
  const allowedInHistory = allowed || events.some(e => /notice of allowance/i.test(str(e.eventDescriptionText)));
  const artUnit = str(m.groupArtUnitNumber) || null;
  const customerNumbers = [...new Set([{ customerNumber: m.customerNumber }, ...arr(record.correspondenceAddressBag), ...arr(m.correspondenceAddressBag)]
    .flatMap(a => {
      const n = Number(a.customerNumber);
      return Number.isSafeInteger(n) && n > 0 ? [n] : [];
    }))];
  return {
    applicationNumber: str(record.applicationNumberText), filingDate: validDate(m.filingDate), grantDate: validDate(m.grantDate),
    artUnit, technologyCenter: artUnit && /^\d{4}$/.test(artUnit) ? artUnit.slice(0, 2) : null,
    status, applicant: str(m.firstApplicantName), category: str(m.applicationTypeCategory), customerNumbers, hasHistory: Array.isArray(record.eventDataBag),
    officeActions: new Set(events.filter(e => ["CTNF", "CTFR"].includes(str(e.eventCode)))
      .map(e => `${str(e.eventCode)}|${str(e.eventDate)}|${str(e.eventDescriptionText)}`)).size,
    rce: eventCounts.RCEX > 0, interview: eventCounts.EXIN + eventCounts.EXAT + eventCounts.EXET > 0,
    eventCounts,
    granted, allowed, allowedInHistory, abandoned,
  };
}
export type BenchmarkMetric = "allowanceRate" | "allowedWithTwoActionsRate" | "officeActionsPerPatent" | "rceRate" | "timeToGrantYears";
export type MetricValue = { value: number | null; denominator: number; numerator: number };
export function calculatePortfolioMetrics(records: MetricApplication[]): Record<BenchmarkMetric | "interviewRate", MetricValue> {
  const history = records.filter(r => r.hasHistory);
  const grants = history.filter(r => r.granted);
  const allowed = history.filter(r => r.allowedInHistory ?? r.allowed);
  const outcomes = records.filter(r => r.allowed || r.abandoned);
  const durations = grants.flatMap(r => {
    if (!r.filingDate || !r.grantDate || r.grantDate < r.filingDate) return [];
    return [(+new Date(r.grantDate) - +new Date(r.filingDate)) / (86400000 * 365.25)];
  });
  const metric = (sum: number, n: number, rate = true): MetricValue =>
    ({ numerator: sum, denominator: n, value: n >= 10 ? sum / n * (rate ? 100 : 1) : null });
  return {
    allowanceRate: metric(outcomes.filter(r => r.allowed).length, outcomes.length),
    allowedWithTwoActionsRate: metric(allowed.filter(r => r.officeActions <= 2).length, allowed.length),
    officeActionsPerPatent: metric(grants.reduce((n, r) => n + r.officeActions, 0), grants.length, false),
    rceRate: metric(history.filter(r => r.rce).length, history.length),
    interviewRate: metric(history.filter(r => r.interview).length, history.length),
    timeToGrantYears: metric(durations.reduce((n, y) => n + y, 0), durations.length, false),
  };
}
