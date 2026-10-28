import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePortfolioMetrics, metricApplication, type MetricApplication } from "../src/lib/portfolio-metrics";
import { computeFirmBenchmark } from "../src/lib/firm-benchmark-math";
const date = "2026-10-28T12:00:00Z";
function apps(prefix: string, n: number, changes: Partial<MetricApplication> = {}): MetricApplication[] {
  return Array.from({ length: n }, (_, i) => ({
    metricVersion: 2,
    applicationNumber: `${prefix}-${i}`, filingDate: "2020-01-01", grantDate: "2023-01-01", category: "REGULAR",
    artUnit: "1723", technologyCenter: "17", status: "Patented Case", applicant: prefix, customerNumbers: [],
    hasHistory: true, officeActions: 3, rce: true, interview: false,
    eventCounts: { CTNF: 2, CTFR: 1, RCEX: 1, EXIN: 0, EXAT: 0, EXET: 0 },
    granted: true, allowed: true, allowedInHistory: true, abandoned: false, ...changes,
  }));
}
const benchmark = (company: MetricApplication[], firm: MetricApplication[]) => computeFirmBenchmark(company, firm, date, ["Company"]);
test("shared metrics deduplicate OA events and read the live ODP metadata customer-number field", () => {
  const record = metricApplication({ applicationNumberText: "123", applicationMetaData: {
    customerNumber: 75359, filingDate: "2020-01-01", grantDate: "2023-01-01", groupArtUnitNumber: "1723", patentNumber: "9",
  }, eventDataBag: [{ eventCode: "CTNF", eventDate: "2021-01-01" }, { eventCode: "CTNF", eventDate: "2021-01-01" }, { eventCode: "RCEX" }, { eventCode: "EXIN" }] });
  assert.deepEqual(record.customerNumbers, [75359]); assert.equal(record.officeActions, 1);
  assert.equal(record.technologyCenter, "17"); assert.equal(record.rce, true); assert.equal(record.interview, true);
  assert.deepEqual(record.eventCounts, { CTNF: 2, CTFR: 0, RCEX: 1, EXIN: 1, EXAT: 0, EXET: 0 });
  const metrics = calculatePortfolioMetrics(apps("A", 10, { officeActions: 2, rce: false }));
  assert.equal(metrics.officeActionsPerPatent.value, 2); assert.equal(metrics.rceRate.value, 0);
  assert.equal(metrics.allowanceRate.value, 100);
});
test("only meaningful winning metrics are emitted; ambiguous metrics are never benchmarked", () => {
  const r = benchmark(apps("Company", 20), apps("Firm", 20, { officeActions: 1, rce: false, grantDate: "2022-01-01" }));
  assert.deepEqual(r.lines.map(l => l.metric).sort(), ["allowedWithTwoActionsRate", "officeActionsPerPatent", "rceRate", "timeToGrantYears"].sort());
  assert.equal(r.lines.some(l => l.metric === "allowanceRate"), false); // tie
  assert.equal(benchmark(apps("Company", 20), apps("Firm", 20, { officeActions: 4 })).lines.length, 0);
});
test("company and each firm TC must meet the metric-specific minimum denominator", () => {
  assert.equal(benchmark(apps("Company", 9), apps("Firm", 20, { officeActions: 1 })).lines.length, 0);
  assert.equal(benchmark(apps("Company", 20), apps("Firm", 9, { officeActions: 1 })).lines.length, 0);
  const firm = [...apps("Firm", 20, { officeActions: 1, hasHistory: false }), ...apps("History", 9, { officeActions: 1 })];
  assert.equal(benchmark(apps("Company", 20), firm).lines.some(l => l.metric === "officeActionsPerPatent"), false);
});
test("TC weights follow the company mix, not the firm's volume; exactly 60% coverage qualifies", () => {
  const company = [...apps("Company", 60), ...apps("CompanyOther", 40, { technologyCenter: "24", artUnit: "2485" })];
  const firm = [...apps("Firm", 10, { officeActions: 1 }), ...apps("FirmOther", 90, { technologyCenter: "24", officeActions: 2 })];
  const line = benchmark(company, firm).lines.find(l => l.metric === "officeActionsPerPatent")!;
  assert.equal(line.value, 1.4); assert.equal(line.denominator, 100); assert.equal(line.coverage, 1);
  assert.equal(benchmark(company, firm.slice(0, 10)).lines.find(l => l.metric === "officeActionsPerPatent")?.coverage, .6);
  const below = [...apps("Company", 59), ...apps("Other", 41, { technologyCenter: null })];
  assert.equal(benchmark(below, firm.slice(0, 10)).lines.length, 0);
});
test("minimum margins are inclusive and use unrounded values", () => {
  const c = apps("Company", 10, { officeActions: 2 });
  const at = apps("Firm", 10, { officeActions: 2 }); at[0].officeActions = 0;
  assert.equal(benchmark(c, at).lines.find(l => l.metric === "officeActionsPerPatent")?.value, 1.8);
  at[0].officeActions = 1;
  assert.equal(benchmark(c, at).lines.some(l => l.metric === "officeActionsPerPatent"), false);
});
test("firm sample excludes company application IDs and same-client applicant records outside the capped company sample", () => {
  const company = apps("Company", 10, { customerNumbers: [75359] });
  const firm = [...company, ...apps("Company", 10, { applicationNumber: "outside-cap", officeActions: 0 })];
  const r = benchmark(company, firm);
  assert.equal(r.excludedApplications, 10); assert.equal(r.companyApplications, 10); assert.equal(r.lines.length, 0);
  const ownAndOther = [...company, ...apps("Firm", 10, { officeActions: 1 })];
  assert.equal(benchmark(company, ownAndOther).lines.find(l => l.metric === "officeActionsPerPatent")?.denominator, 10);
});
test("same filing window, category restriction, missing dates and missing dataset fail closed", () => {
  const company = apps("Company", 10);
  assert.equal(benchmark(company, apps("Firm", 20, { filingDate: "2019-12-31", officeActions: 0 })).lines.length, 0);
  assert.equal(benchmark(company, apps("Firm", 20, { category: "DESIGN", officeActions: 0 })).lines.length, 0);
  assert.equal(computeFirmBenchmark(company, apps("Firm", 20), null, ["Company"]).lines.length, 0);
  company[0].filingDate = null;
  assert.equal(benchmark(company, apps("Firm", 20)).lines.length, 0);
});
test("empty and missing event histories are excluded rather than counted as zero actions", () => {
  const raw = { applicationMetaData: { patentNumber: "9", applicationStatusDescriptionText: "Patented Case" } };
  const empty = metricApplication({ ...raw, eventDataBag: [] });
  const missing = metricApplication(raw);
  assert.equal(empty.hasHistory, false); assert.equal(missing.hasHistory, false);
  assert.equal(metricApplication({ ...raw, eventDataBag: [null, {}] }).hasHistory, false);
  const metrics = calculatePortfolioMetrics(Array.from({ length: 10 }, () => empty));
  assert.equal(metrics.officeActionsPerPatent.value, null); assert.equal(metrics.officeActionsPerPatent.denominator, 0);
  assert.equal(metrics.allowedWithTwoActionsRate.value, null);
  const firstActionAllowance = metricApplication({ ...raw, eventDataBag: [{ eventCode: "NOA", eventDescriptionText: "Notice of Allowance" }] });
  assert.equal(calculatePortfolioMetrics(Array.from({ length: 10 }, () => firstActionAllowance)).officeActionsPerPatent.value, 0);
});
