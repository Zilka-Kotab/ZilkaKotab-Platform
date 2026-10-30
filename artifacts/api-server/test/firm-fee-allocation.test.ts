import { test } from "node:test";
import assert from "node:assert/strict";
import { feeAllocations } from "../src/lib/firm-fee-allocation";
import type { WorkflowBilling } from "@workspace/db";
const staff = [{ id: 1, name: "Owner" }, { id: 2, name: "Assignee" }];
const draft: WorkflowBilling = { scheduleId: null, entryId: null, code: "", jurisdiction: "", subjectMatter: "", itemShort: "Flat fee", description: "", details: "", notes: "", amountCents: 100000, ownerId: 1, ownerShareBasisPoints: 4000, ownerFixedCents: null, assigneeId: 2, assigneeShareBasisPoints: 4000 };
test("each share uses gross, not the remaining balance", () => {
  assert.deepEqual(feeAllocations(draft, staff).map((a) => a.amountCents), [40000, 40000]);
});
test("owner fixed allocation is independent of the assignee gross percentage", () => {
  assert.deepEqual(feeAllocations({ ...draft, ownerFixedCents: 10000 }, staff).map((a) => a.amountCents), [10000, 40000]);
});
test("over-allocation, unknown recipients and duplicate recipients fail explicitly", () => {
  assert.throws(() => feeAllocations({ ...draft, ownerShareBasisPoints: 7000 }, staff), /exceed/);
  assert.throws(() => feeAllocations({ ...draft, ownerId: 3 }, staff), /active/);
  assert.throws(() => feeAllocations({ ...draft, assigneeId: 1 }, staff), /different/);
});
