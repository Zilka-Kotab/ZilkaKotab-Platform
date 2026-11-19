import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPatentOverviewInput,
  generatePatentOverview,
  hasCurrentPatentOverviewPromptVersion,
  hasSamePatentClaimVersions,
  patentOverviewInputProvenance,
  PROMPT_VERSION,
  validatePatentOverviewOutput,
  type PatentOverviewInput,
  type PatentOverviewClaim,
} from "../src/lib/ai/tasks/patent-overview";
import { getNextMaintenanceFee } from "../src/lib/patent-maintenance";
import type { AzureResponsesClient } from "../src/lib/ai/azure-client";

const patent = {
  patentNumber: "US12345678B2",
  title: "Test patent title",
  assignee: "Example Corp",
  patentStatus: "Active",
  sourceStatus: "Active",
  filingDate: "2020-01-02",
  issueDate: "2020-02-03",
  earliestPriorityDate: "2019-01-01",
  inventors: ["Test Inventor"],
};

const claims: PatentOverviewClaim[] = [
  {
    id: 1,
    publicId: "claim-public-1",
    claimNumber: "1",
    version: 2,
    claimText: "A system for identifying abnormal readings in a distributed sensor network.",
    claimType: "INDEPENDENT",
    selectedForMonitoring: true,
  },
  {
    id: 2,
    publicId: "claim-public-2",
    claimNumber: "2",
    version: 1,
    claimText: "The system of claim 1.",
    claimType: "DEPENDENT",
    selectedForMonitoring: false,
  },
];

function longDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function summaryFor(input: PatentOverviewInput) {
  const statusSentence = input.patentStatus.toLowerCase() === "active"
    ? "The USPTO record currently lists the patent as active and does not report an abandonment or lapse."
    : `The USPTO record lists the patent status as ${input.patentStatus}.`;
  let deadlineSentence: string;
  if (input.nextMaintenanceFee.availability === "UPCOMING") {
    deadlineSentence = `The ${input.nextMaintenanceFee.window} is due ${longDate(input.nextMaintenanceFee.dueDate!)}, with the grace period ending ${longDate(input.nextMaintenanceFee.graceEndDate!)}.`;
  } else if (input.nextMaintenanceFee.availability === "NONE") {
    deadlineSentence = "There is no upcoming maintenance fee in the app's computed schedule.";
  } else {
    deadlineSentence = "Maintenance fee timing cannot be determined from the current record.";
  }
  return [
    "This invention, assigned to Example Corp, uses a distributed sensor network to identify unusual equipment behavior before it interrupts factory operations, helping technicians target inspections, reduce avoidable downtime, and coordinate maintenance using measurements already collected during routine system operation.",
    statusSentence,
    deadlineSentence,
  ].join(" ");
}

test("overview input is public-source only and records exact claim provenance", () => {
  const input = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  const provenance = patentOverviewInputProvenance(input, claims);
  assert.equal(provenance.classification, "PUBLIC_SOURCE");
  assert.deepEqual(provenance.claimIdsAndVersions, [{ claimId: "claim-public-1", claimNumber: "1", version: 2 }]);
  assert.deepEqual(Object.keys(input), ["assignee", "patentStatus", "independentClaims", "nextMaintenanceFee", "truncation"]);
  assert.equal(JSON.stringify(input).includes("Test patent title"), false);
  assert.equal(JSON.stringify(input).includes("12345678"), false);
  assert.equal(JSON.stringify(input).includes("Test Inventor"), false);
  assert.equal(JSON.stringify(input).includes("attorney"), false);
  assert.equal(JSON.stringify(input).includes("workspace"), false);
  assert.deepEqual(input.nextMaintenanceFee, {
    availability: "UPCOMING",
    window: "3.5-year fee",
    dueDate: "2023-08-03",
    graceEndDate: "2024-02-03",
  });
});

test("claim-version idempotency ignores JSON object key order but detects changed snapshots", () => {
  const current = [{
    claimId: "claim-public-1",
    claimNumber: "1",
    version: 2,
    selectedForMonitoring: true,
  }];
  const stored = [{
    selectedForMonitoring: true,
    version: 2,
    claimNumber: "1",
    claimId: "claim-public-1",
  }];
  assert.equal(hasSamePatentClaimVersions(stored, current), true);
  assert.equal(hasSamePatentClaimVersions([{ ...stored[0], version: 3 }], current), false);
});

test("overview prompt version changes invalidate prior summaries", () => {
  assert.equal(PROMPT_VERSION, "overview-v2");
  assert.equal(hasCurrentPatentOverviewPromptVersion("overview-v2"), true);
  assert.equal(hasCurrentPatentOverviewPromptVersion("overview-v1"), false);
  assert.equal(hasCurrentPatentOverviewPromptVersion(undefined), false);
});

test("maintenance fee calculation provides due date and window without inventing an amount", () => {
  assert.deepEqual(
    getNextMaintenanceFee("2020-02-03", "Active", new Date("2024-01-01T12:00:00Z")),
    {
      availability: "UPCOMING",
      window: "3.5-year fee",
      dueDate: "2023-08-03",
      graceEndDate: "2024-02-03",
    },
  );
  assert.equal(getNextMaintenanceFee(null, "Active").availability, "UNKNOWN");
  assert.equal(getNextMaintenanceFee("2020-02-03", "Expired - Fee Related").availability, "NONE");
});

test("overview output rejects out-of-range, unsupported, or prohibited content", () => {
  const input = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  const summary = summaryFor(input);
  const validOutput = { summary, attention: "LOW" as const };
  assert.doesNotThrow(() => validatePatentOverviewOutput(validOutput, input));
  assert.throws(() => validatePatentOverviewOutput({
    ...validOutput,
    summary: summary.replace("August 3, 2023", "August 3, 2024"),
  }, input));
  assert.throws(() => validatePatentOverviewOutput({
    ...validOutput,
    summary: summary.replace("3.5-year", "99-year"),
  }, input));
  assert.throws(() => validatePatentOverviewOutput({
    ...validOutput,
    summary: summary.replace("This invention", "We developed this invention"),
  }, input));
  assert.throws(() => validatePatentOverviewOutput({
    ...validOutput,
    summary: summary.replace("distributed sensor network", "Test patent title"),
  }, input, [{ label: "patent title", value: "Test patent title" }]));
  assert.doesNotThrow(() => validatePatentOverviewOutput(validOutput, input, [
    { label: "patent number", value: "3202322024" },
  ]));
});

test("overview output rejects summaries outside the required word range", () => {
  const input = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  assert.throws(() => validatePatentOverviewOutput({
    summary: "This invention is useful. The USPTO record lists it as active. No upcoming maintenance fee.",
    attention: "LOW",
  }, input));
});

test("sentence validation does not split a U.S. abbreviation into another sentence", () => {
  const input = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  const summary = summaryFor(input).replace(
    "The USPTO record currently lists",
    "The U.S. Patent and Trademark Office (USPTO) currently lists",
  );
  assert.doesNotThrow(() => validatePatentOverviewOutput({
    summary,
    attention: "LOW",
  }, input));
});

test("sentence validation tolerates one extra punctuation boundary while preserving status and deadline checks", () => {
  const input = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  const summary = summaryFor(input).replace(
    "uses a distributed sensor network to identify",
    "is designed for practical use. It uses a distributed sensor network to identify",
  );
  assert.doesNotThrow(() => validatePatentOverviewOutput({
    summary,
    attention: "LOW",
  }, input));
});

test("status validation accepts an explicit status without requiring the USPTO acronym", () => {
  const input = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  const summary = summaryFor(input).replace(
    "The USPTO record currently lists the patent as active",
    "The patent is active",
  );
  assert.doesNotThrow(() => validatePatentOverviewOutput({
    summary,
    attention: "LOW",
  }, input));
});

test("status validation recognizes issued patents recorded as a patented case", () => {
  const baseInput = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  const input = { ...baseInput, patentStatus: "Patented Case" };
  const summary = summaryFor(baseInput).replace(
    "The USPTO record currently lists the patent as active",
    "The patent is issued",
  );
  assert.doesNotThrow(() => validatePatentOverviewOutput({
    summary,
    attention: "LOW",
  }, input));
});

test("inactive USPTO status and reason must be stated without estimating expiration", () => {
  const expiredPatent = {
    ...patent,
    patentStatus: "Expired - Fee Related",
    sourceStatus: "Expired - Fee Related",
  };
  const input = buildPatentOverviewInput(expiredPatent, claims, new Date("2024-01-01T12:00:00Z"));
  const validSummary = summaryFor(input);
  assert.doesNotThrow(() => validatePatentOverviewOutput({
    summary: validSummary,
    attention: "LOW",
  }, input));
  assert.throws(() => validatePatentOverviewOutput({
    summary: validSummary.replace("Expired - Fee Related", "Expired"),
    attention: "LOW",
  }, input));
  assert.throws(() => validatePatentOverviewOutput({
    summary: validSummary.replace("helping technicians", "which expires in 2040, helping technicians"),
    attention: "LOW",
  }, input));
});

test("overview task parses fake Azure output without making a network request", async () => {
  const input = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  const previousDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
  const client: AzureResponsesClient = {
    responses: {
      async create() {
        return {
          id: "resp_overview",
          model: "gpt-5.4-mini",
          output_text: JSON.stringify({
            summary: summaryFor(input),
            attention: "MEDIUM",
          }),
          usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 },
        };
      },
    },
  };
  try {
    const result = await generatePatentOverview({
      projectId: 1,
      patentId: 2,
      input,
      client,
      prohibitedDetails: [
        { label: "patent title", value: patent.title },
        { label: "patent number", value: patent.patentNumber },
      ],
    });
    assert.equal(result.responseId, "resp_overview");
    assert.equal(result.data.attention, "MEDIUM");
  } finally {
    if (previousDeployment === undefined) delete process.env.AZURE_OPENAI_DEPLOYMENT;
    else process.env.AZURE_OPENAI_DEPLOYMENT = previousDeployment;
  }
});

test("overview generation retries content rejected by validation", async () => {
  const input = buildPatentOverviewInput(patent, claims, new Date("2024-01-01T12:00:00Z"));
  const previousDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
  let calls = 0;
  const instructions: string[] = [];
  const client: AzureResponsesClient = {
    responses: {
      async create(params) {
        calls += 1;
        instructions.push(params.instructions);
        return {
          id: `resp_overview_${calls}`,
          model: "gpt-5.4-mini",
          output_text: JSON.stringify({
            summary: calls === 1
              ? summaryFor(input).replace("distributed sensor network", "Test patent title")
              : summaryFor(input),
            attention: "LOW",
          }),
          usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 },
        };
      },
    },
  };
  try {
    const result = await generatePatentOverview({
      projectId: 1,
      patentId: 2,
      input,
      client,
      prohibitedDetails: [{ label: "patent title", value: "Test patent title" }],
    });
    assert.equal(calls, 2);
    assert.equal(result.responseId, "resp_overview_2");
    assert.match(instructions[1], /Test patent title/);
  } finally {
    if (previousDeployment === undefined) delete process.env.AZURE_OPENAI_DEPLOYMENT;
    else process.env.AZURE_OPENAI_DEPLOYMENT = previousDeployment;
  }
});
