export type AnalysisRunRole = "ADMIN" | "ATTORNEY" | "CLIENT" | "PARALEGAL";
export type ProjectAiProvider = "CLIENT_MICROSOFT" | "ZK_MANAGED_AI" | "MANUAL";

export function effectiveProjectAiProvider(
  configuredProvider: ProjectAiProvider | null | undefined,
  azureConfigured: boolean,
): ProjectAiProvider {
  if (!azureConfigured || configuredProvider === "MANUAL") return "MANUAL";
  return "ZK_MANAGED_AI";
}

export function manualAnalysisRunErrorStatus(role: AnalysisRunRole) {
  return role === "CLIENT" ? 403 : null;
}

export function clientCanViewAnalysisRun(
  run: { reviewStatus: string; analysisType?: string },
  reviews: Array<{ status: string; reviewerId: number }>,
  reviewers: Array<{ id: number; role: AnalysisRunRole }>,
) {
  if (run.analysisType === "OVERVIEW") return true;
  if (run.reviewStatus === "ATTORNEY_REVIEWED" || run.reviewStatus === "FINAL") return true;
  const reviewerRoles = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.role]));
  return reviews.some((review) =>
    (review.status === "ATTORNEY_REVIEWED" || review.status === "FINAL")
    && (reviewerRoles.get(review.reviewerId) === "ATTORNEY" || reviewerRoles.get(review.reviewerId) === "ADMIN")
  );
}
