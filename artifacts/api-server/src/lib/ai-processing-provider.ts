import type { AiProcessingProvider } from "@workspace/db";

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
  ZK_MANAGED_AI: new UnconfiguredProvider("ZK_MANAGED_AI"),
  MANUAL: new UnconfiguredProvider("MANUAL"),
};