import type {
  PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis,
  PublicFirmBenchmarkLinesItem, PublicFirmBenchmarkLinesItemMetric,
} from '@workspace/api-client-react';

export type ComparisonReportSide = {
  portfolio: PublicPortfolioAnalysis;
  advanced?: PublicPortfolioAdvancedAnalysis;
};
export type ComparisonCell = { value: string; sample?: number; benchmark?: PublicFirmBenchmarkLinesItem };
export type ComparisonRow = { label: string; cells: ComparisonCell[] };
export const reportNumber = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? 'N/A' : value.toLocaleString('en-US');
export const reportPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? 'N/A' : `${value.toFixed(1)}%`;
export const firmValue = (line: PublicFirmBenchmarkLinesItem) =>
  line.unit === 'percent' ? reportPercent(line.value) : line.unit === 'years' ? `${line.value.toFixed(1)} yrs` : line.value.toFixed(1);

/** Server-qualified lines only; never create a firm benchmark from the other company. */
export function comparisonBenchmark(side: ComparisonReportSide, metric: PublicFirmBenchmarkLinesItemMetric, value: number | null | undefined, higher = false) {
  if (value == null || !Number.isFinite(value)) return undefined;
  return side.advanced?.firmBenchmark?.lines.find((line) =>
    line.metric === metric && Number.isFinite(line.value) && line.denominator >= 10 &&
    line.companyDenominator >= 10 && line.coverage >= 0.6 && line.coverage <= 1 &&
    (higher ? line.value > value : line.value < value));
}

export function comparisonReportRows(sides: readonly ComparisonReportSide[]): ComparisonRow[] {
  const row = (label: string, get: (side: ComparisonReportSide) => ComparisonCell) => ({ label, cells: sides.map(get) });
  const cell = (value: number | null | undefined, format = reportNumber, sample?: number, benchmark?: PublicFirmBenchmarkLinesItem): ComparisonCell =>
    ({ value: format(value), sample, benchmark });
  const decimal = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? 'N/A' : value.toFixed(2);
  const years = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? 'N/A' : `${value.toFixed(1)} yrs`;
  return [
    row('Granted - status unverified', (s) => cell(s.portfolio.identifiedGrantedPatents)),
    row('Identified pending applications', (s) => cell(s.portfolio.identifiedPendingApplications)),
    row('Expired / inactive identified', (s) => cell(s.portfolio.expiredInactivePatents)),
    row('Grants in last 12 months', (s) => cell(s.portfolio.recentGrantCount)),
    row('Overall allowance rate', (s) => {
      const p = s.advanced?.portfolioInsights;
      return cell(p?.overallAllowanceRate, reportPercent, p?.knownFinalOutcomes, comparisonBenchmark(s, 'allowanceRate', p?.overallAllowanceRate, true));
    }),
    row('Abandonment share of known outcomes', (s) => {
      const p = s.advanced?.portfolioInsights;
      return cell(p?.overallAllowanceRate != null && p.knownFinalOutcomes > 0 ? 100 - p.overallAllowanceRate : null, reportPercent, p?.knownFinalOutcomes);
    }),
    row('Average time to grant', (s) => {
      const p = s.advanced?.portfolioInsights;
      const value = p?.averageTimeToGrantMonths == null ? null : p.averageTimeToGrantMonths / 12;
      return cell(value, years, p?.grantDurationSampleSize, comparisonBenchmark(s, 'timeToGrantYears', value));
    }),
    row('Average pending application age', (s) => cell(s.advanced?.portfolioInsights.averagePendingAgeYears, years, s.advanced?.portfolioInsights.pendingAgeSampleSize)),
    row('Avg. office actions per granted patent', (s) => {
      const e = s.advanced?.prosecutionEfficiency;
      return cell(e?.averageOfficeActionsPerGrantedPatent, decimal, e?.officeActionDenominator, comparisonBenchmark(s, 'officeActionsPerPatent', e?.averageOfficeActionsPerGrantedPatent));
    }),
    row('RCE rate', (s) => {
      const e = s.advanced?.prosecutionEfficiency;
      return cell(e?.rceRate, reportPercent, e?.rceDenominator, comparisonBenchmark(s, 'rceRate', e?.rceRate));
    }),
    row('Examiner interview rate', (s) => cell(s.advanced?.prosecutionEfficiency.examinerInterviewRate, reportPercent, s.advanced?.prosecutionEfficiency.interviewDenominator)),
    row('Allowed with <=2 office actions', (s) => {
      const e = s.advanced?.prosecutionEfficiency;
      return cell(e?.allowedWithTwoOrFewerActionsRate, reportPercent, e?.allowedWithHistory, comparisonBenchmark(s, 'allowedWithTwoActionsRate', e?.allowedWithTwoOrFewerActionsRate, true));
    }),
  ];
}
