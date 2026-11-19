import OpenAI from "openai";
import { logger } from "../logger";

export interface AzureUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type AzureErrorCode =
  | "AZURE_NOT_CONFIGURED"
  | "AZURE_SCHEMA_VIOLATION"
  | "AZURE_RATE_LIMITED"
  | "AZURE_API_ERROR";

export class AzureStructuredOutputError extends Error {
  constructor(
    readonly code: AzureErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AzureStructuredOutputError";
  }
}

export interface AzureResponse {
  id: string;
  model: string;
  output_text: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

export interface AzureResponsesClient {
  responses: {
    create(params: {
      model: string;
      instructions: string;
      input: string;
      text: {
        format: {
          type: "json_schema";
          name: string;
          strict: true;
          schema: Record<string, unknown>;
        };
      };
      max_output_tokens: number;
    }): Promise<AzureResponse>;
  };
}

export interface GenerateStructuredOptions<T> {
  task: string;
  promptVersion: string;
  instructions: string;
  input: unknown;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  projectId?: number;
  patentId?: number;
  client?: AzureResponsesClient;
  parseOutput?: (text: string) => T;
}

export interface GenerateStructuredResult<T> {
  data: T;
  usage: AzureUsage;
  model: string;
  responseId: string;
}

let activeCalls = 0;
const callQueue: Array<() => void> = [];

async function withConcurrencyLimit<T>(operation: () => Promise<T>): Promise<T> {
  if (activeCalls >= 3) {
    await new Promise<void>((resolve) => callQueue.push(resolve));
  }
  activeCalls += 1;
  try {
    return await operation();
  } finally {
    activeCalls -= 1;
    callQueue.shift()?.();
  }
}

export function isAzureConfigured(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_BASE_URL?.trim()
      && process.env.AZURE_OPENAI_API_KEY?.trim()
      && process.env.AZURE_OPENAI_DEPLOYMENT?.trim(),
  );
}

export function warnIfAzureUnconfigured(): void {
  if (!isAzureConfigured()) {
    logger.warn(
      { code: "AZURE_AI_NOT_CONFIGURED" },
      "Azure AI is not configured. Set AZURE_OPENAI_BASE_URL, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT to enable it.",
    );
  }
}

function createDefaultClient(): AzureResponsesClient | null {
  if (!isAzureConfigured()) return null;
  return new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: process.env.AZURE_OPENAI_BASE_URL,
    timeout: 30_000,
    maxRetries: 3,
  }) as unknown as AzureResponsesClient;
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  return typeof candidate.status === "number"
    ? candidate.status
    : typeof candidate.statusCode === "number"
      ? candidate.statusCode
      : undefined;
}

function retryAfterMilliseconds(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  const candidate = error as { headers?: Record<string, string | undefined> };
  const value = candidate.headers?.["retry-after"];
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 0;
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function matchesSchema(value: unknown, schema: Record<string, unknown>, path = "root"): boolean {
  const type = typeof schema.type === "string" ? schema.type : undefined;
  if (type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    const properties = schema.properties && typeof schema.properties === "object"
      ? schema.properties as Record<string, Record<string, unknown>>
      : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : [];
    if (required.some((key) => !(key in record))) return false;
    if (schema.additionalProperties === false) {
      if (Object.keys(record).some((key) => !(key in properties))) return false;
    }
    return Object.entries(properties).every(([key, property]) => !(key in record) || matchesSchema(record[key], property, `${path}.${key}`));
  }
  if (type === "array") {
    if (!Array.isArray(value)) return false;
    const item = schema.items && typeof schema.items === "object"
      ? schema.items as Record<string, unknown>
      : null;
    return !item || value.every((entry) => matchesSchema(entry, item, `${path}[]`));
  }
  if (type === "string") {
    if (typeof value !== "string") return false;
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) return false;
    return typeof schema.minLength !== "number" || value.length >= schema.minLength;
  }
  if (type === "number" || type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    if (type === "integer" && !Number.isInteger(value)) return false;
  }
  if (type === "boolean" && typeof value !== "boolean") return false;
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => entry === value)) return false;
  return true;
}

export async function generateStructured<T>({
  task,
  promptVersion,
  instructions,
  input,
  schema,
  maxOutputTokens,
  projectId,
  patentId,
  client,
  parseOutput,
}: GenerateStructuredOptions<T>): Promise<GenerateStructuredResult<T>> {
  const startedAt = Date.now();
  let responseId = "";
  let usage: AzureUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

  try {
    const selectedClient = client ?? createDefaultClient();
    if (!selectedClient) {
      throw new AzureStructuredOutputError(
        "AZURE_NOT_CONFIGURED",
        "Azure AI is not configured.",
      );
    }
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
    if (!deployment) {
      throw new AzureStructuredOutputError(
        "AZURE_NOT_CONFIGURED",
        "Azure AI deployment is not configured.",
      );
    }

    let response: AzureResponse | undefined;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        response = await withConcurrencyLimit(() => selectedClient.responses.create({
          model: deployment,
          instructions,
          input: JSON.stringify(input),
          text: {
            format: {
              type: "json_schema",
              name: task.replace(/[^a-zA-Z0-9_-]/g, "_"),
              strict: true,
              schema,
            },
          },
          max_output_tokens: maxOutputTokens,
        }));
        break;
      } catch (error) {
        if (statusOf(error) === 429 && attempt < 3) {
          await wait(retryAfterMilliseconds(error) || 250 * (2 ** attempt));
          continue;
        }
        if (statusOf(error) === 429) {
          throw new AzureStructuredOutputError(
            "AZURE_RATE_LIMITED",
            "Azure AI is temporarily rate limited.",
            error,
          );
        }
        throw new AzureStructuredOutputError(
          "AZURE_API_ERROR",
          "Azure AI could not complete the request.",
          error,
        );
      }
    }
    if (!response) {
      throw new AzureStructuredOutputError(
        "AZURE_API_ERROR",
        "Azure AI returned no response.",
      );
    }

    responseId = response.id;
    usage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    };

    let data: T;
    try {
      const parsed: unknown = parseOutput
        ? parseOutput(response.output_text)
        : JSON.parse(response.output_text);
      if (!matchesSchema(parsed, schema)) {
        throw new Error("Parsed output does not match the strict JSON schema");
      }
      data = parsed as T;
    } catch (error) {
      throw new AzureStructuredOutputError(
        "AZURE_SCHEMA_VIOLATION",
        "Azure AI returned output that did not match the required schema.",
        error,
      );
    }

    return {
      data,
      usage,
      model: response.model,
      responseId,
    };
  } finally {
    logger.info({
      task,
      promptVersion,
      projectId,
      patentId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      durationMs: Date.now() - startedAt,
      responseId,
    }, "Azure structured AI call completed");
  }
}
