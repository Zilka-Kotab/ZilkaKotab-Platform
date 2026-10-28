import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchContinuationBatch, fetchRceEvidence } from "../src/lib/examiner-rce-evidence";
const a = "18123456", b = "18123457", child = "19123456";
const relation = (parent = a, kind = "CON", c = child) => ({ parentApplicationNumberText: parent, childApplicationNumberText: c, claimParentageTypeCode: kind });
const bag = (relations: unknown[], id = child) => ({ applicationNumberText: id, applicationMetaData: { filingDate: "2025-01-01" }, parentContinuityBag: relations });
test("batch verifies CON links, preserves child dates, and confirms negatives only after a complete index", async () => {
  const result = await fetchContinuationBatch([a, b], async () => Response.json({ count: 1, patentFileWrapperDataBag: [bag([relation()])] }));
  assert.equal(result.get(a)?.state, "yes"); assert.equal(result.get(b)?.state, "no");
  assert.deepEqual(result.get(a)?.children, [{ applicationNumber: child, filingDate: "2025-01-01" }]);
});
test("a descendant can contain an intermediate direct-child link; it is not counted as another child", async () => {
  const result = await fetchContinuationBatch([a], async () => Response.json({ count: 2, patentFileWrapperDataBag: [
    bag([relation()]), bag([relation(), relation(child, "CON", "20123456")], "20123456"),
  ] }));
  assert.equal(result.get(a)?.state, "yes"); assert.equal(result.get(a)?.children?.length, 1);
});
test("DIV/CIP and foreign/provisional links are not continuations", async () => {
  const result = await fetchContinuationBatch([a], async () => Response.json({ count: 1, patentFileWrapperDataBag: [
    bag([relation(a, "DIV"), relation(a, "CIP"), relation(a, "CON", "EP18111111"), relation(a, "CON", "63123456")]),
  ] }));
  assert.equal(result.get(a)?.state, "no");
});
test("PCT and foreign search results are valid excluded relationships, not a broken batch", async () => {
  const result = await fetchContinuationBatch([a, b], async () => Response.json({ count: 2, patentFileWrapperDataBag: [
    bag([relation(a, "CON", "PCTUS2007009710")], "PCTUS2007009710"),
    bag([relation(a, "CON", "EP18111111")], "EP18111111"),
  ] }));
  assert.equal(result.get(a)?.state, "no"); assert.equal(result.get(b)?.state, "no");
});
test("specific no-matches response is negative; unrelated 404 and failures never are", async () => {
  const none = await fetchContinuationBatch([a], async () => Response.json({ detailedMessage: "No matching records found, refine search" }, { status: 404 }));
  assert.equal(none.get(a)?.state, "no");
  const broken = await fetchContinuationBatch([a], async () => Response.json({ message: "Not found" }, { status: 404 }));
  assert.equal(broken.get(a)?.state, "unavailable");
});
test("truncated or malformed pages cannot make other parents negative", async () => {
  const short = await fetchContinuationBatch([a, b], async () => Response.json({ count: 2, patentFileWrapperDataBag: [bag([relation()])] }));
  assert.equal(short.get(b)?.state, "unavailable");
  const malformed = await fetchContinuationBatch([a], async () => Response.json({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: child }] }));
  assert.equal(malformed.get(a)?.state, "unavailable");
});
test("explicit positive relationships survive a later page failure but other parents remain unknown", async () => {
  let n = 0;
  const result = await fetchContinuationBatch([a, b], async () => ++n === 1
    ? Response.json({ count: 101, patentFileWrapperDataBag: Array.from({ length: 100 }, (_, i) => bag([relation(a, "CON", String(19000000 + i))], String(19000000 + i))) })
    : Response.json({ message: "Missing page" }, { status: 404 }));
  assert.equal(result.get(a)?.state, "yes"); assert.equal(result.get(b)?.state, "unavailable");
});
test("a filed RCE request marked Not Entered counts as filing, not acceptance", async () => {
  let calls = 0;
  const result = await fetchRceEvidence(a, async () => ++calls === 1
    ? Response.json({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: a, eventDataBag: [{ eventCode: "BRCE", eventDescriptionText: "Workflow - Request for RCE - Begin" }] }] })
    : Response.json({ count: 1, documentBag: [{ applicationNumberText: a, documentCode: "RCE.NE", documentCodeDescriptionText: "Request for Continued Examination(RCE) Not Entered" }] }));
  assert.equal(result.state, "yes"); assert.match(result.note, /not proof of acceptance/);
});
test("workflow-only markers require complete document verification before a negative", async () => {
  const request = (complete: boolean) => {
    let calls = 0;
    return fetchRceEvidence(a, async () => ++calls === 1
      ? Response.json({ count: 1, patentFileWrapperDataBag: [{ applicationNumberText: a, eventDataBag: [{ eventCode: "FRCE", eventDescriptionText: "Workflow - Request for RCE - Finish" }] }] })
      : Response.json({ count: complete ? 0 : 1, documentBag: [] }));
  };
  assert.equal((await request(true)).state, "no");
  assert.equal((await request(false)).state, "unavailable");
});
