import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicFirmBenchmarkLinesItem, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';
import { comparisonBenchmark, comparisonReportRows, type ComparisonReportSide } from '../src/components/ai-tools/portfolio-comparison-report-data';

const line = (metric: PublicFirmBenchmarkLinesItem['metric'], value: number): PublicFirmBenchmarkLinesItem =>
  ({ metric, value, unit: metric === 'timeToGrantYears' ? 'years' : metric === 'officeActionsPerPatent' ? 'count' : 'percent', denominator: 123, companyDenominator: 50, coverage: .8 });
function side(name: string, grants: number, lines: PublicFirmBenchmarkLinesItem[] = []): ComparisonReportSide {
  return {
    portfolio: { companyName: name, identifiedGrantedPatents: grants, identifiedPendingApplications: 20, expiredInactivePatents: null, recentGrantCount: 7 } as ComparisonReportSide['portfolio'],
    advanced: {
      portfolioInsights: { overallAllowanceRate: 80, knownFinalOutcomes: 50, averageTimeToGrantMonths: 36, grantDurationSampleSize: 45, averagePendingAgeYears: 2, pendingAgeSampleSize: 20 },
      prosecutionEfficiency: { averageOfficeActionsPerGrantedPatent: 2, officeActionDenominator: 45, rceRate: 30, rceDenominator: 100, examinerInterviewRate: 25, interviewDenominator: 100, allowedWithTwoOrFewerActionsRate: 60, allowedWithHistory: 45 },
      firmBenchmark: { lines },
    } as PublicPortfolioAdvancedAnalysis,
  };
}

test('consolidated rows preserve each company values and denominators', () => {
  const rows = comparisonReportRows([side('First', 123), side('Second', 456)]);
  assert.equal(rows.length, 12);
  assert.deepEqual(rows[0].cells.map((c) => c.value), ['123', '456']);
  assert.deepEqual(rows[4].cells.map((c) => c.sample), [50, 50]);
  assert.equal(rows[5].cells[0].value, '20.0%');
  assert.equal(rows[6].cells[0].value, '3.0 yrs');
});
test('missing advanced metrics remain N/A rather than fabricated zeros', () => {
  const s = side('Missing', 0); s.advanced = undefined;
  const rows = comparisonReportRows([s, side('Available', 10)]);
  assert.equal(rows[0].cells[0].value, '0');
  assert.equal(rows[2].cells[0].value, 'N/A');
  assert.equal(rows[4].cells[0].value, 'N/A');
  assert.equal(rows[5].cells[0].value, 'N/A');
});
test('zero is a valid metric and allowance 100 implies zero abandonment', () => {
  const s = side('Zero', 1);
  s.advanced!.portfolioInsights.overallAllowanceRate = 100;
  s.advanced!.prosecutionEfficiency.rceRate = 0;
  const rows = comparisonReportRows([s, s]);
  assert.equal(rows[5].cells[0].value, '0.0%');
  assert.equal(rows[9].cells[0].value, '0.0%');
});
test('firm advantages can appear against one company without leaking into the other', () => {
  const a = side('First', 1, [line('allowanceRate', 90)]);
  const b = side('Second', 2);
  const row = comparisonReportRows([a, b])[4];
  assert.equal(row.cells[0].benchmark?.value, 90);
  assert.equal(row.cells[1].benchmark, undefined);
});
test('both matched firm comparisons retain independent benchmark values', () => {
  const row = comparisonReportRows([side('First', 1, [line('allowanceRate', 90)]), side('Second', 2, [line('allowanceRate', 95)])])[4];
  assert.deepEqual(row.cells.map((c) => c.benchmark?.value), [90, 95]);
});
test('tied, unfavorable, non-finite, insufficient and poorly covered firm lines stay hidden', () => {
  for (const b of [line('allowanceRate', 80), line('allowanceRate', 70), line('allowanceRate', NaN),
    { ...line('allowanceRate', 90), denominator: 9 }, { ...line('allowanceRate', 90), companyDenominator: 9 },
    { ...line('allowanceRate', 90), coverage: .59 }]) {
    assert.equal(comparisonBenchmark(side('First', 1, [b]), 'allowanceRate', 80, true), undefined);
  }
});
test('lower values are favorable for action counts, RCE and grant duration only with supplied evidence', () => {
  const s = side('First', 1, [line('officeActionsPerPatent', 1.5), line('rceRate', 20), line('timeToGrantYears', 2.5)]);
  assert.equal(comparisonBenchmark(s, 'officeActionsPerPatent', 2)?.value, 1.5);
  assert.equal(comparisonBenchmark(s, 'rceRate', 30)?.value, 20);
  assert.equal(comparisonBenchmark(s, 'timeToGrantYears', 3)?.value, 2.5);
  assert.equal(comparisonBenchmark(side('No firm evidence', 1), 'rceRate', 30), undefined);
});
