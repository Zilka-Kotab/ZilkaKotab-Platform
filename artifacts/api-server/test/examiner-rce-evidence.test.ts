import { test } from "node:test";
import assert from "node:assert/strict";
import { evidence, parseRceTransactions, parseContinuationChildren, fetchRceEvidence, fetchContinuationEvidence } from "../src/lib/examiner-rce-evidence";
import { matureExaminerCohort, calculateIndependentExaminerRate } from "../src/lib/examiner-rce-store";

const app = "18107054", child = "19123456";
const relation = (kind = "CON", parent = app, number = child) => ({ parentApplicationNumberText: parent, childApplicationNumberText: number, claimParentageTypeCode: kind, childApplicationFilingDate: "2025-01-01" });
const event = (code = "RCEX", description = "Request for Continued Examination (RCE)") => ({ eventCode: code, eventDescriptionText: description, eventDate: "2023-10-13" });
const wrapper = (record: object) => ({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: app, ...record }] });

test("multiple RCE filings are positive once, not ordinary amendments or continuation filings", () => {
  assert.equal(parseRceTransactions(app, [event(), event()]).state, "yes");
  assert.equal(parseRceTransactions(app, [event("A...", "After-final amendment"), event("CON", "Continuation application filed")]).state, "no");
  assert.equal(parseRceTransactions(app, undefined).state, "unavailable");
  assert.equal(parseRceTransactions(app, []).state, "unavailable");
  assert.equal(parseRceTransactions(app, [{}]).state, "unavailable");
  assert.equal(parseRceTransactions(app, [event("X", "RCE related notice")]).state, "unavailable");
});
test("continuations deduplicate children, retain dates and exclude DIV, CIP, provisional and foreign members", () => {
  const e = parseContinuationChildren(app, [relation(), relation(), relation("DIV", app, "19123457"), relation("CIP", app, "19123458"), relation("CON", app, "63123456"), relation("CON", app, "PCT/US2020/123456"), relation("CON", app, "EP18111111")]);
  assert.equal(e.state, "yes");
  assert.deepEqual(e.children, [{ applicationNumber: child, filingDate: "2025-01-01" }]);
  assert.equal(parseContinuationChildren(app, [relation("DIV"), relation("CIP")]).state, "no");
});
test("missing or malformed continuity, a different parent, conflicting dates and unknown relationship are not negative", () => {
  for (const raw of [undefined, [{}], [relation("CON", "11111111")], [relation("OTHER")]]) assert.equal(parseContinuationChildren(app, raw).state, "unavailable");
  assert.equal(parseContinuationChildren(app, [relation()], { [app]: "2026-01-01" }).state, "unavailable");
  assert.equal(parseContinuationChildren(app, []).state, "no");
});
test("dedicated endpoint errors and wrong application identity do not become negative", async () => {
  assert.equal((await fetchContinuationEvidence(app, async () => Response.json({ message: "Not found" }, { status: 404 }))).state, "error");
  assert.equal((await fetchRceEvidence(app, async () => Response.json(wrapper({ applicationNumberText: "11111111", eventDataBag: [event()] })))).state, "error");
});
test("missing child bag requires reverse verification even after a successful dedicated response", async () => {
  const urls: string[] = [];
  const e = await fetchContinuationEvidence(app, async url => {
    urls.push(url.toString());
    return urls.length === 1 ? Response.json(wrapper({ parentContinuityBag: [] }))
      : Response.json({ code: "404", detailedMessage: "No matching records found, refine your search criteria and try again" }, { status: 404 });
  });
  assert.equal(urls.length, 2); assert.ok(urls[1].includes("parentContinuityBag"));
  assert.equal(e.state, "no"); assert.match(e.note, /reverse/i);
});
test("reverse continuation lookup recovers child IDs without counting unrelated ancestors", async () => {
  let calls = 0;
  const e = await fetchContinuationEvidence(app, async () => ++calls === 1
    ? Response.json(wrapper({ parentContinuityBag: [] }))
    : Response.json({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: child, parentContinuityBag: [relation(), relation("CON", "11111111", "12121212")] }] }));
  assert.equal(e.state, "yes"); assert.equal(e.children?.length, 1); assert.equal(e.children?.[0].applicationNumber, child);
});
test("incomplete reverse pages and API failures remain unknown", async () => {
  let calls = 0;
  const e = await fetchContinuationEvidence(app, async () => ++calls === 1
    ? Response.json(wrapper({ parentContinuityBag: [] }))
    : Response.json({ count: 2, patentFileWrapperDataBag: [] }));
  assert.equal(e.state, "unavailable");
});
test("ambiguous RCE transaction evidence is cross-checked against document metadata", async () => {
  let calls = 0;
  const e = await fetchRceEvidence(app, async () => ++calls === 1
    ? Response.json(wrapper({ eventDataBag: [event("UNKNOWN", "Request for Continued Examination")] }))
    : Response.json({ documentBag: [{ applicationNumberText: app, documentCode: "RCEX", documentCodeDescriptionText: "Request for Continued Examination (RCE)", officialDate: "2023-10-13" }] }));
  assert.equal(calls, 2); assert.equal(e.state, "yes"); assert.match(e.source, /documents$/);
});
test("24-month cohort uses calendar dates, deduplicates and excludes recent, design and invalid-date records", () => {
  const record = (id: string, date: string, type = "Utility") => ({ applicationNumberText: id, applicationMetaData: { filingDate: date, applicationTypeCategory: "REGULAR", applicationTypeLabelName: type } });
  const c = matureExaminerCohort([record(app, "2024-02-29"), record(app, "2024-02-29"), record(child, "2024-03-01"), record("19123457", "2020-01-01", "Design"), record("19123458", "2024-02-30")], new Date("2026-02-28"));
  assert.equal(c.cutoff, "2024-02-28"); assert.equal(c.cohort.ids.length, 0); assert.equal(c.excluded, 4);
  const valid = matureExaminerCohort([record(app, "2024-02-28")], new Date("2026-02-28"));
  assert.deepEqual(valid.cohort.ids, [app]);
});
test("RCE and continuation use independent numerators and never reduce rates by treating unknowns as negatives", () => {
  const ids = Array.from({ length: 10 }, (_, i) => String(18000000 + i));
  const job = { id: "", cohort: { ids, dates: {} }, cutoff: "2024-10-28", excluded: 0, state: "complete" as const, updated_at: new Date() };
  const rows = new Map(ids.map((id, i) => [id, { tx: evidence(i < 4 ? "yes" : "no", "transactions", ""), continuity: evidence(i < 2 ? "yes" : "no", "continuity", "") }]));
  assert.equal(calculateIndependentExaminerRate(job, rows, "tx").rate, 40);
  assert.equal(calculateIndependentExaminerRate(job, rows, "continuity").rate, 20);
  rows.get(ids[9])!.continuity = evidence("error", "continuity", "API failure");
  const incomplete = calculateIndependentExaminerRate(job, rows, "continuity");
  assert.equal(incomplete.rate, null); assert.equal(incomplete.numerator, 2); assert.equal(incomplete.denominator, 10);
  assert.equal(calculateIndependentExaminerRate(job, rows, "tx").rate, 40);
  for (const r of rows.values()) r.tx = evidence("no", "transactions", "");
  assert.equal(calculateIndependentExaminerRate(job, rows, "tx").rate, 0);
});
