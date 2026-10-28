import type { PublicExaminerAnalysis } from '@workspace/api-client-react';

/** Historical dated roles support a lower-bound activity span, never employment. */
export function examinerActivitySpan(data: Pick<PublicExaminerAnalysis, 'roleEvidence' | 'coverage'>): string | null {
  const history = data.roleEvidence?.history;
  if (history?.coverageStatus !== 'historical' || !['medium', 'high'].includes(history.confidence)
    || history.yearsObserved == null || !Number.isFinite(history.yearsObserved) || history.yearsObserved < 0) return null;
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
  const supported = Math.min(elapsed, Math.floor(history.yearsObserved * 10) / 10);
  if (history.confidence === 'medium') {
    const evidence = history.evidence ?? [];
    const dates = evidence.map(item => item.issueDate).sort();
    if (new Set(evidence.map(item => item.applicationNumber)).size < 2 || dates[0] !== date) return null;
    const last = new Date(`${dates.at(-1)}T00:00:00Z`);
    if (!Number.isFinite(last.getTime()) || last > end || last.toISOString().slice(0, 10) !== dates.at(-1)) return null;
    const verifiedSpan = (last.getTime() - start.getTime()) / (365.2425 * 86400000);
    const lowerBound = Math.floor(Math.min(supported, verifiedSpan));
    return lowerBound >= 1 ? `${lowerBound}+ years` : null;
  }
  return supported < 1 ? 'Less than 1 year' : `${supported.toFixed(1)} years`;
}
