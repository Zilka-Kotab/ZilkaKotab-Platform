import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clientCanViewAnalysisRun,
  effectiveProjectAiProvider,
  manualAnalysisRunErrorStatus,
} from "../src/lib/patent-monitor-security";

test("clients receive 403 when creating analysis runs", () => {
  assert.equal(manualAnalysisRunErrorStatus("CLIENT"), 403);
  assert.equal(manualAnalysisRunErrorStatus("ATTORNEY"), null);
  assert.equal(manualAnalysisRunErrorStatus("ADMIN"), null);
});

test("clients never receive unreviewed analysis runs", () => {
  assert.equal(clientCanViewAnalysisRun(
    { reviewStatus: "UNREVIEWED" },
    [],
    [],
  ), false);

  assert.equal(clientCanViewAnalysisRun(
    { reviewStatus: "UNREVIEWED" },
    [{ status: "CLIENT_REVIEWED", reviewerId: 10 }],
    [{ id: 10, role: "CLIENT" }],
  ), false);
});

test("clients receive runs approved by attorney or administrator status", () => {
  assert.equal(clientCanViewAnalysisRun(
    { reviewStatus: "ATTORNEY_REVIEWED" },
    [],
    [],
  ), true);
  assert.equal(clientCanViewAnalysisRun(
    { reviewStatus: "FINAL" },
    [],
    [],
  ), true);
});

test("clients receive runs with attorney or administrator approval events", () => {
  assert.equal(clientCanViewAnalysisRun(
    { reviewStatus: "UNREVIEWED" },
    [{ status: "ATTORNEY_REVIEWED", reviewerId: 20 }],
    [{ id: 20, role: "ATTORNEY" }],
  ), true);
  assert.equal(clientCanViewAnalysisRun(
    { reviewStatus: "UNREVIEWED" },
    [{ status: "FINAL", reviewerId: 21 }],
    [{ id: 21, role: "ADMIN" }],
  ), true);
  assert.equal(clientCanViewAnalysisRun(
    { reviewStatus: "UNREVIEWED" },
    [{ status: "ATTORNEY_REVIEWED", reviewerId: 22 }],
    [{ id: 22, role: "CLIENT" }],
  ), false);
});

test("generic provider selection retains MANUAL mode for non-overview analyses", () => {
  assert.equal(effectiveProjectAiProvider(undefined, true), "ZK_MANAGED_AI");
  assert.equal(effectiveProjectAiProvider(undefined, false), "MANUAL");
  assert.equal(effectiveProjectAiProvider("MANUAL", true), "MANUAL");
  assert.equal(effectiveProjectAiProvider("CLIENT_MICROSOFT", true), "ZK_MANAGED_AI");
});

test("clients can see overviews immediately regardless of review status", () => {
  for (const reviewStatus of ["UNREVIEWED", "CLIENT_REVIEWED", "ATTORNEY_REVIEWED", "FINAL"]) {
    assert.equal(clientCanViewAnalysisRun(
      { analysisType: "OVERVIEW", reviewStatus },
      [],
      [],
    ), true);
  }
});
