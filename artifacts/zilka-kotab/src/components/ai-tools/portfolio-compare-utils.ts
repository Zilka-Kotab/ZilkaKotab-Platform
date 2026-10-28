import type { useAnalyzePublicPortfolioAdvanced, PublicPortfolioAnalysis } from '@workspace/api-client-react';

export const scopeKey = (names: string[]) => names.map((n) => n.trim().toLowerCase()).sort().join('|');

/** Returns advanced data only when it was produced for exactly this applicant scope. */
export function advancedFor(request: ReturnType<typeof useAnalyzePublicPortfolioAdvanced>, names: string[]) {
  if (!request.isSuccess || !request.data) return undefined;
  const requested = request.variables?.data.selectedApplicantNames ?? [];
  return scopeKey(requested) === scopeKey(names) ? request.data : undefined;
}

export const hasRecords = (d: PublicPortfolioAnalysis) =>
  d.identifiedGrantedPatents + d.identifiedPendingApplications > 0 || d.recentApplications.length > 0;
