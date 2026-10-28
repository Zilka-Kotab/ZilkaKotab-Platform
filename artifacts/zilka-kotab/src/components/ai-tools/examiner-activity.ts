import type { PublicExaminerAnalysis } from '@workspace/api-client-react';

/** Calendar-year elapsed span, rounded down; never an assertion of continuous employment. */
export function examinerActivitySpan(data: Pick<PublicExaminerAnalysis, 'roleEvidence' | 'coverage'>): string | null {
  const date = data.roleEvidence?.earliestActivity?.issueDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00Z`);
  const end = new Date(data.coverage.retrievedAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
    || start.toISOString().slice(0, 10) !== date || end < start) return null;
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  let anniversary = new Date(start);
  anniversary.setUTCFullYear(start.getUTCFullYear() + years);
  if (anniversary > end) {
    years--;
    anniversary = new Date(start);
    anniversary.setUTCFullYear(start.getUTCFullYear() + years);
  }
  const next = new Date(start);
  next.setUTCFullYear(start.getUTCFullYear() + years + 1);
  const elapsed = Math.floor((years + (end.getTime() - anniversary.getTime()) / (next.getTime() - anniversary.getTime())) * 10) / 10;
  return elapsed < 1 ? 'Less than 1 year' : `${elapsed.toFixed(1)} years`;
}
