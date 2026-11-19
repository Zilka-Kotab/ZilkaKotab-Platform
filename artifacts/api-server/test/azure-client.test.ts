import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AzureStructuredOutputError,
  generateStructured,
  isAzureConfigured,
  type AzureResponse,
  type AzureResponsesClient,
} from "../src/lib/ai/azure-client";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
  },
  required: ["summary"],
};

test("reports configured and unconfigured Azure settings", () => {
  const previous = {
    baseUrl: process.env.AZURE_OPENAI_BASE_URL,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  };
  delete process.env.AZURE_OPENAI_BASE_URL;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_DEPLOYMENT;
  assert.equal(isAzureConfigured(), false);

  process.env.AZURE_OPENAI_BASE_URL = "https://example.openai.azure.com/openai/v1";
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
  assert.equal(isAzureConfigured(), true);

  if (previous.baseUrl === undefined) delete process.env.AZURE_OPENAI_BASE_URL;
  else process.env.AZURE_OPENAI_BASE_URL = previous.baseUrl;
  if (previous.apiKey === undefined) delete process.env.AZURE_OPENAI_API_KEY;
  else process.env.AZURE_OPENAI_API_KEY = previous.apiKey;
  if (previous.deployment === undefined) delete process.env.AZURE_OPENAI_DEPLOYMENT;
  else process.env.AZURE_OPENAI_DEPLOYMENT = previous.deployment;
});

test("parses a successful structured response", async () => {
  process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
  const client: AzureResponsesClient = {
    responses: {
      async create() {
        return {
          id: "resp_success",
          model: "gpt-5.4-mini",
          output_text: JSON.stringify({ summary: "Supported summary" }),
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        };
      },
    },
  };

  const result = await generateStructured<{ summary: string }>({
    task: "test_task",
    promptVersion: "test-v1",
    instructions: "Return JSON.",
    input: { patentNumber: "123" },
    schema,
    maxOutputTokens: 100,
    projectId: 1,
    patentId: 2,
    client,
  });

  assert.equal(result.data.summary, "Supported summary");
  assert.equal(result.responseId, "resp_success");
  assert.equal(result.model, "gpt-5.4-mini");
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15 });
});

test("returns a typed schema violation error", async () => {
  process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
  const client: AzureResponsesClient = {
    responses: {
      async create(): Promise<AzureResponse> {
        return {
          id: "resp_schema",
          model: "gpt-5.4-mini",
          output_text: JSON.stringify({ extra: true }),
        };
      },
    },
  };

  await assert.rejects(
    generateStructured({
      task: "test_task",
      promptVersion: "test-v1",
      instructions: "Return JSON.",
      input: {},
      schema,
      maxOutputTokens: 100,
      client,
    }),
    (error: unknown) => error instanceof AzureStructuredOutputError
      && error.code === "AZURE_SCHEMA_VIOLATION",
  );
});

test("retries a fake 429 and then succeeds", async () => {
  process.env.AZURE_OPENAI_DEPLOYMENT = "test-deployment";
  let attempts = 0;
  const client: AzureResponsesClient = {
    responses: {
      async create(): Promise<AzureResponse> {
        attempts += 1;
        if (attempts === 1) {
          throw Object.assign(new Error("rate limited"), {
            status: 429,
            headers: { "retry-after": "0" },
          });
        }
        return {
          id: "resp_retry",
          model: "gpt-5.4-mini",
          output_text: JSON.stringify({ summary: "Retry succeeded" }),
        };
      },
    },
  };

  const result = await generateStructured<{ summary: string }>({
    task: "test_task",
    promptVersion: "test-v1",
    instructions: "Return JSON.",
    input: {},
    schema,
    maxOutputTokens: 100,
    client,
  });

  assert.equal(attempts, 2);
  assert.equal(result.data.summary, "Retry succeeded");
});
