import assert from "node:assert/strict";
import { test } from "node:test";
import { assignedStaffIds, appCollParticipants } from "../src/lib/firm-workflow-identity";
const staff = [
  { id: 1, name: "Alex Brown", email: "alex@example.invalid" },
  { id: 2, name: "Jane Smith", email: "jane@example.invalid" },
  { id: 3, name: "Alex Brown", email: "alex2@example.invalid" },
];
test("AppColl ownership and contributors use exact, unique identities", () => {
  assert.deepEqual(assignedStaffIds("alex@example.invalid", staff), [1]);
  assert.deepEqual(assignedStaffIds("Alex Brown", staff), [], "duplicate names must not leak tasks");
  assert.deepEqual(assignedStaffIds("Smith, Jane", staff), [2]);
  assert.deepEqual(assignedStaffIds("Jane", staff), [], "no first-name or substring authorization");
  assert.deepEqual(appCollParticipants("", { Contributors: "Alex <alex@example.invalid>; Jane Smith" }, staff), [1, 2]);
  assert.deepEqual(appCollParticipants("", { Client: "Jane Smith", Notes: "alex@example.invalid" }, staff), []);
});
