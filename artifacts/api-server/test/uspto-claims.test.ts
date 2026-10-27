import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { planClaimRefresh } from "../src/lib/patent-claim-refresh.ts";
import { parseClaims } from "../src/lib/uspto.ts";

const grantXml = await readFile(
  new URL("./fixtures/uspto-grant-nested-claims.xml", import.meta.url),
  "utf8",
);

const expectedClaimTexts = [
  [
    "1. A wireless sensor comprising:",
    "a housing; and",
    "a processor configured to:",
    "receive a signal from a remote device;",
    "calculate a temperature estimate from the signal.",
  ].join("\n"),
  [
    "2. The wireless sensor of claim 1, wherein",
    "the processor stores the estimate in memory; and",
    "the processor transmits the estimate upon request.",
  ].join("\n"),
];

function normalizeClaimText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

test("USPTO claims include every nested claim-text descendant in document order", () => {
  const claims = parseClaims(grantXml);

  assert.equal(claims.length, 2);
  assert.deepEqual(claims.map((claim) => claim.claimNumber), ["1", "2"]);
  assert.deepEqual(claims.map((claim) => normalizeClaimText(claim.claimText)), expectedClaimTexts.map(normalizeClaimText));
  assert.deepEqual(claims.map((claim) => claim.claimType), ["INDEPENDENT", "DEPENDENT"]);
  assert.deepEqual(claims.map((claim) => claim.dependsOnClaimNumber), [null, "1"]);
});

test("refresh creates later claim versions without changing prior versions or monitoring selections", () => {
  const parsedClaims = parseClaims(grantXml);
  const existingVersions = [
    { id: 102, claimNumber: "1", version: 2, claimText: "Current claim 1", selectedForMonitoring: true },
    { id: 101, claimNumber: "1", version: 1, claimText: "Original claim 1", selectedForMonitoring: false },
    { id: 201, claimNumber: "2", version: 1, claimText: "Original dependent claim", selectedForMonitoring: false },
  ];
  const originalSnapshot = structuredClone(existingVersions);

  const plan = planClaimRefresh(existingVersions, parsedClaims, {
    patentId: 8,
    source: "USPTO",
    sourceIdentifier: "US-APP-123",
    retrievedAt: new Date("2026-09-24T12:00:00.000Z"),
    createdById: 4,
  });

  assert.deepEqual(plan.priorVersions, originalSnapshot);
  assert.deepEqual(existingVersions, originalSnapshot);
  assert.deepEqual(
    plan.newVersions.map(({ claimNumber, version, selectedForMonitoring }) => ({
      claimNumber,
      version,
      selectedForMonitoring,
    })),
    [
      { claimNumber: "1", version: 3, selectedForMonitoring: true },
      { claimNumber: "2", version: 2, selectedForMonitoring: false },
    ],
  );
  assert.deepEqual(
    plan.newVersions.map((claim) => normalizeClaimText(claim.claimText)),
    expectedClaimTexts.map(normalizeClaimText),
  );
});