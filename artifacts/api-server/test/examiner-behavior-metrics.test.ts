import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateExaminerBehaviorMetrics } from "../src/lib/examiner-behavior-metrics";

const mail = (date: string, eventCode = "MCTNF") => ({ eventCode, eventDate: date });
const app = (n: number, events = [mail("2026-03-18")], children: unknown = []) => ({
  applicationNumberText: `${10000000 + n}`, eventDataBag: events, childContinuityBag: children,
});
const child = (n: number, kind = "CON") => ({
  parentApplicationNumberText: `${10000000 + n}`, childApplicationNumberText: "20000000",
  claimParentageTypeCode: kind,
});

test("quarter end uses exact 14 calendar days of all four quarter-end months", () => {
  const dates = ["2026-03-17", "2026-03-18", "2026-06-16", "2026-06-17", "2026-09-16", "2026-09-17", "2025-12-17", "2025-12-18", "2026-04-30", "2026-05-31"];
  const metric = calculateExaminerBehaviorMetrics(dates.map((date, i) => app(i, [mail(date)]))).quarterEndConcentration;
  assert.equal(metric.rate, 40); assert.equal(metric.numerator, 4); assert.equal(metric.denominator, 10);
});
test("mailing dates, not internal action or applicant-response dates, drive concentration", () => {
  const records = Array.from({ length: 10 }, (_, n) => app(n, [
    mail("2026-03-18"), mail("2026-03-18"), mail("2026-03-01", "CTNF"),
    mail("2026-04-01", "CTFR"), mail("2026-04-30", "REM"), mail("2026-02-30", "MCTFR"),
  ]));
  const metric = calculateExaminerBehaviorMetrics([...records, records[0]]).quarterEndConcentration;
  assert.equal(metric.denominator, 10); assert.equal(metric.rate, 100);
});
test("a genuine zero-quarter-end result remains zero, while missing dates remain unavailable", () => {
  assert.equal(calculateExaminerBehaviorMetrics(Array.from({ length: 10 }, (_, n) => app(n, [mail("2026-04-01")]))).quarterEndConcentration.rate, 0);
  assert.equal(calculateExaminerBehaviorMetrics([app(1, [mail("")])]).quarterEndConcentration.rate, null);
});
test("continuation/RCE union deduplicates applications and excludes CIP and DIV", () => {
  const records = Array.from({ length: 10 }, (_, n) => app(n, [{ eventCode: "FILE", eventDate: "2025-01-01" }]));
  records[0] = app(0, [mail("2025-01-01", "RCEX"), mail("2025-01-02", "RCEX")], [child(0), child(0)]);
  records[1] = app(1, [mail("2025-01-01")], [child(1)]);
  records[2] = app(2, [mail("2025-01-01")], [child(2, "CIP")]);
  records[3] = app(3, [mail("2025-01-01")], [child(3, "DIV")]);
  const metric = calculateExaminerBehaviorMetrics([...records, records[0]]).continuationRce;
  assert.equal(metric.denominator, 10); assert.equal(metric.numerator, 2); assert.equal(metric.rate, 20);
});
test("missing continuity, empty histories, and malformed relationships are not negative outcomes", () => {
  const records = Array.from({ length: 10 }, (_, n) => app(n));
  const missing = { applicationNumberText: "10000010", eventDataBag: [mail("2026-03-18")] };
  assert.equal(calculateExaminerBehaviorMetrics([...records, missing]).continuationRce.rate, null);
  assert.equal(calculateExaminerBehaviorMetrics([...records, app(11, [])]).continuationRce.denominator, 10);
  assert.equal(calculateExaminerBehaviorMetrics([...records, app(12, [mail("2026-03-18")], [{ ...child(12), parentApplicationNumberText: "wrong" }])]).continuationRce.rate, null);
  assert.equal(calculateExaminerBehaviorMetrics(records).continuationRce.rate, 0);
});
