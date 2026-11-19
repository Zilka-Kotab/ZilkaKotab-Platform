import type { AiProcessingProvider } from "@workspace/db";
import { isAzureConfigured } from "./ai/azure-client";

export const PARSE_CLAIM_LIMITATIONS_OPERATION = "PARSE_CLAIM_LIMITATIONS" as const;

export interface ClaimLimitationParseInput {
  operation: typeof PARSE_CLAIM_LIMITATIONS_OPERATION;
  patentIdentifier: string;
  claimNumber: string;
  authoritativeClaimText: string;
  attorneyInstructions?: string;
}

export interface ClaimLimitationParseOutput {
  operation: typeof PARSE_CLAIM_LIMITATIONS_OPERATION;
  limitations: Array<{
    identifier: string;
    limitationText: string;
    rationale?: string;
    confidence?: number;
    uncertainty?: string;
  }>;
  providerProvenance?: Record<string, unknown>;
}

export interface AnalysisInput {
  projectId: number;
  patentId?: number;
  claimId?: number;
  publicSourceItemIds: number[];
  confidentialItemIds: number[];
}

export interface AnalysisOutput {
  summary: string;
  triage: "HIGH" | "MEDIUM" | "LOW";
  limitationAnalysis: unknown[];
  evidence: unknown[];
  providerProvenance: Record<string, unknown>;
}

export interface AIProcessingProvider {
  readonly id: AiProcessingProvider;
  readonly connected: boolean;
  process(input: AnalysisInput): Promise<AnalysisOutput>;
}

class UnconfiguredProvider implements AIProcessingProvider {
  readonly connected = false;

  constructor(readonly id: AiProcessingProvider) {}

  async process(_input: AnalysisInput): Promise<AnalysisOutput> {
    throw new Error(`${this.id} processing is not configured.`);
  }
}

export const aiProcessingProviders: Record<AiProcessingProvider, AIProcessingProvider> = {
  CLIENT_MICROSOFT: new UnconfiguredProvider("CLIENT_MICROSOFT"),
  ZK_MANAGED_AI: {
    id: "ZK_MANAGED_AI",
    connected: isAzureConfigured(),
    async process(input: AnalysisInput): Promise<AnalysisOutput> {
      if (!isAzureConfigured()) throw new Error("ZK_MANAGED_AI processing is not configured.");
      if (!input.patentId) throw new Error("Patent ID is required for a patent overview.");
      throw new Error("Use the patent-overview route task directly.");
    },
  },
  MANUAL: new UnconfiguredProvider("MANUAL"),
};