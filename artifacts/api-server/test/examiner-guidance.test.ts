import { test } from "node:test";
import assert from "node:assert/strict";
import { matchExaminerContact, lookupExaminerContact } from "../src/lib/examiner-contact";
import { recommendExaminerStrategy, strategyEvidence } from "../src/lib/examiner-strategy";

const examiner = { firstName: "CHRISTOPHER", middleName: "P", lastName: "DOMONE", coreAreaCode: "P" };
test("phone-only directory lookup is cached and never returns email or document evidence", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input: URL, init: RequestInit) => {
    requests++;
    assert.equal(input.searchParams.get("Employee name"), "EXAMPLE, JANE");
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json({ data: [{ firstName: "JANE", middleName: "Q", lastName: "EXAMPLE",
      coreAreaCode: "P", displayPhoneNo: "(571) 555-1234", extension: "42", email: "ignored@uspto.gov" }],
      totalRecords: 1, hasNextPage: false });
  });
  const result = await lookupExaminerContact("EXAMPLE, JANE Q");
  assert.equal(result.phone, "(571) 555-1234 ext. 42");
  assert.equal(result.email, null);
  assert.equal(result.verificationMethod, "directory");
  assert.deepEqual(result.sourceDocuments, []);
  assert.equal(await lookupExaminerContact("EXAMPLE, JANE Q"), result);
  assert.equal(requests, 1);
});
test("directory failure does not throw or require a PDF fallback", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("Timed out", "TimeoutError"); });
  const result = await lookupExaminerContact("EXAMPLE, UNAVAILABLE");
  assert.equal(result.status, "unavailable");
  assert.equal(result.phone, null);
  assert.equal(result.email, null);
  assert.deepEqual(result.sourceDocuments, []);
});
test("ambiguous directory identities and invalid numbers remain unavailable", async (t) => {
  const entry = { firstName: "DUPLICATE", lastName: "EXAMPLE", coreAreaCode: "P", phoneNo: "5715551234" };
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({ data: [entry, entry], totalRecords: 2 }));
  assert.equal((await lookupExaminerContact("EXAMPLE, DUPLICATE")).phone, null);
  fetchMock.mock.mockImplementation(async () => Response.json({ data: [{ ...entry, firstName: "INVALID", phoneNo: "123" }], totalRecords: 1 }));
  const missing = await lookupExaminerContact("EXAMPLE, INVALID");
  assert.equal(missing.phone, null);
  assert.equal(missing.status, "unavailable");
});
test("directory contact matches a patent examiner, not a similar name or another core area", () => {
  assert.equal(matchExaminerContact("DOMONE, CHRISTOPHER P", [examiner]), examiner);
  assert.equal(matchExaminerContact("Christopher P. Domone", [examiner]), examiner);
  assert.equal(matchExaminerContact("DOMONE, CHRISTOPHER X", [examiner]), null);
  assert.equal(matchExaminerContact("DOMONE, C P", [examiner]), null);
  assert.equal(matchExaminerContact("DOMONE, CHRISTOPHER P", [{ ...examiner, coreAreaCode: "T" }]), null);
  assert.equal(matchExaminerContact("DOMONE, CHRISTOPHER", [examiner, { ...examiner, middleName: "X" }]), null);
});

// These are explicitly synthetic statistics, never shown as USPTO results.
const analysis = {
  examinerName: "Synthetic Example", disposedApplications: 100, allowedApplications: 80,
  estimatedAllowanceRate: 80, averageProsecutionDurationMonths: 30,
  coverage: { truncated: true, note: "Synthetic test sample" },
  officeActionAnalytics: { applicationsWithEventData: 100, medianMonthsFilingToFirstAction: 18,
    averageNonFinalActionsPerApplication: 1, averageFinalActionsPerApplication: 0.4 },
  interviewAnalytics: { interviewSummaryAllowed: 45, interviewSummaryAbandoned: 5, noSummaryAllowed: 35, noSummaryAbandoned: 15 },
} as Parameters<typeof strategyEvidence>[0];

test("strategy compares disposed cases only and withholds small interview groups", () => {
  const evidence = strategyEvidence(analysis);
  assert.equal(evidence.interviewComparison?.withInterview.percent, 90);
  assert.equal(evidence.interviewComparison?.withoutLocatedInterview.percent, 70);
  assert.equal(evidence.interviewComparison?.differencePoints, 20);
  const small = { ...analysis, interviewAnalytics: { ...analysis.interviewAnalytics!, interviewSummaryAllowed: 2, interviewSummaryAbandoned: 1 } };
  assert.equal(strategyEvidence(small).interviewComparison, null);
  assert.equal("rceRate" in evidence, false, "Incomplete asynchronous RCE evidence must not be invented");
});

test("insufficient data has an explicit no-recommendation state, without calling AI", async () => {
  assert.equal((await recommendExaminerStrategy({ ...analysis, disposedApplications: 5 })).status, "insufficient_data");
  const noEvents = { ...analysis, officeActionAnalytics: null, interviewAnalytics: null };
  assert.equal((await recommendExaminerStrategy(noEvents)).status, "insufficient_data");
});

test("opt-in genuine AI output is succinct and cached", {
  skip: process.env.RUN_EXAMINER_AI_TEST !== "1",
}, async () => {
  const result = await recommendExaminerStrategy(analysis);
  assert.equal(result.status, "ready", result.note);
  assert.ok(result.summary && result.approach);
  assert.ok(`${result.summary} ${result.approach}`.split(/\s+/).length <= 110);
  assert.strictEqual(await recommendExaminerStrategy(analysis), result);
  console.log("Synthetic-fixture AI output:", JSON.stringify({ summary: result.summary, approach: result.approach }));
});
