import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsPDF } from 'jspdf';
import type { PublicFirmBenchmarkLinesItem, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';
import { comparisonBenchmark, comparisonCompanyLabel, comparisonReportRows, comparisonWinner, type ComparisonReportSide } from '../src/components/ai-tools/portfolio-comparison-report-data';
import { COMPARISON_COLORS, drawComparisonCharts } from '../src/components/ai-tools/portfolio-comparison-pdf-charts';
import { comparisonTableColumns, drawComparisonTable } from '../src/components/ai-tools/portfolio-comparison-pdf-table';

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
  assert.equal(rows.length, 9);
  assert.deepEqual(rows.map((row) => row.label), [
    'Granted patents', 'Pending applications', 'Expired / inactive patents',
    'Average time to grant', 'Avg. office actions per granted patent', 'RCE rate',
    'Examiner interview rate', 'Allowed with <=2 office actions', 'Overall allowance rate',
  ]);
  assert.deepEqual(rows[0].cells.map((c) => c.value), ['123', '456']);
  assert.deepEqual(rows[8].cells.map((c) => c.sample), [50, 50]);
  assert.equal(rows[8].cells[0].value, '80.0%');
  assert.equal(rows[3].cells[0].value, '3.0 yrs');
});
test('missing advanced metrics remain N/A rather than fabricated zeros', () => {
  const s = side('Missing', 0); s.advanced = undefined;
  const rows = comparisonReportRows([s, side('Available', 10)]);
  assert.equal(rows[0].cells[0].value, '0');
  assert.equal(rows[2].cells[0].value, 'N/A');
  assert.equal(rows[4].cells[0].value, 'N/A');
  assert.equal(rows[5].cells[0].value, 'N/A');
});
test('zero RCE and 100% allowance remain valid metrics', () => {
  const s = side('Zero', 1);
  s.advanced!.portfolioInsights.overallAllowanceRate = 100;
  s.advanced!.prosecutionEfficiency.rceRate = 0;
  const rows = comparisonReportRows([s, s]);
  assert.equal(rows[5].cells[0].value, '0.0%');
  assert.equal(rows[8].cells[0].value, '100.0%');
});
test('firm advantages can appear against one company without leaking into the other', () => {
  const a = side('First', 1, [line('allowanceRate', 90)]);
  const b = side('Second', 2);
  const row = comparisonReportRows([a, b])[8];
  assert.equal(row.cells[0].benchmark?.value, 90);
  assert.equal(row.cells[1].benchmark, undefined);
});
test('both matched firm comparisons retain independent benchmark values', () => {
  const row = comparisonReportRows([side('First', 1, [line('allowanceRate', 90)]), side('Second', 2, [line('allowanceRate', 95)])])[8];
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
test('charts use company names and full-scope grant trends, not recent-grant list lengths', () => {
  const a = side('First Company', 1), b = side('Second Company', 2);
  for (const s of [a, b]) {
    s.portfolio.filingTrends = [{ year: 2026, count: 111 }];
    s.portfolio.grantTrends = [{ year: 2026, count: 777 }];
    s.portfolio.recentGrantCount = 999;
    s.portfolio.recentGrants = [];
  }
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  drawComparisonCharts(pdf, [a, b], 300);
  const content = pdf.output();
  assert.ok(content.includes('(FIRST COMPANY)'));
  assert.ok(content.includes('(SECOND COMPANY)'));
  assert.ok(content.includes('(GRANT TREND)'));
  assert.ok(content.includes('(777)'));
  assert.ok(!content.includes('(999)'));
  assert.ok(!content.includes('as in table above'));
});
test('old or missing grant data stays unavailable, not a false zero trend', () => {
  const a = side('First Company', 1), b = side('Second Company', 2);
  a.portfolio.filingTrends = b.portfolio.filingTrends = [];
  a.portfolio.grantTrends = [{ year: 2026, count: 77 }];
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  drawComparisonCharts(pdf, [a, b], 300);
  assert.ok(pdf.output().includes('(N/A)'));
});
test('comparison uses blue and exact muted burgundy, never firm gold as a company color', () => {
  assert.deepEqual(COMPARISON_COLORS, [[34, 69, 108], [150, 63, 82]]);
});
test('six-column table has separate firm values, merged section labels and no sample annotations', () => {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const bottom = drawComparisonTable(pdf, [
    side('First Company', 123, [line('allowanceRate', 90), line('officeActionsPerPatent', 1.5)]),
    side('Second Company', 456, [line('allowanceRate', 95)]),
  ]);
  const content = pdf.output();
  assert.equal(bottom, 286);
  for (const label of ['SECTION', 'METRIC', 'FIRST COMPANY', 'SECOND COMPANY', 'ZILKA-KOTAB', 'BENCHMARK', 'PORTFOLIO', 'AT A GLANCE', 'PROSECUTION', 'EFFICIENCY', '90.0%', '95.0%', '1.5']) {
    assert.ok(content.includes(`(${label})`), label);
  }
  assert.ok(!content.includes('n='));
  assert.ok(!content.includes('cover'));
  assert.equal(content.split('(PROSECUTION)').length - 1, 1);
  assert.equal(content.split('(PORTFOLIO)').length - 1, 1);
});
test('benchmark columns appear independently only for sides with qualifying improvements', () => {
  for (const [first, second] of [[false, false], [true, false], [false, true], [true, true]]) {
    const rows = comparisonReportRows([
      side('First', 1, first ? [line('allowanceRate', 90)] : []),
      side('Second', 2, second ? [line('allowanceRate', 95)] : []),
    ]);
    const columns = comparisonTableColumns(rows);
    assert.equal(columns.length, 4 + Number(first) + Number(second));
    assert.deepEqual(columns.filter((c) => c.kind === 'benchmark').map((c) => c.side),
      [first ? 0 : -1, second ? 1 : -1].filter((i) => i >= 0));
    assert.equal(columns.reduce((width, c) => width + c.width, 0), 540);
    assert.equal(columns.at(-1)!.x + columns.at(-1)!.width, 576);
    columns.forEach((c, i) => { if (i) assert.equal(c.x, columns[i - 1].x + columns[i - 1].width); });
  }
});
test('tied or inferior firm lines cannot introduce otherwise empty benchmark columns', () => {
  const rows = comparisonReportRows([side('First', 1, [line('allowanceRate', 80)]), side('Second', 2, [line('allowanceRate', 70)])]);
  assert.equal(comparisonTableColumns(rows).length, 4);
});
test('winning cells use metric direction, never assume higher is always better', () => {
  const a = side('First', 1), b = side('Second', 2);
  b.advanced!.portfolioInsights.averageTimeToGrantMonths = 48;
  b.advanced!.portfolioInsights.overallAllowanceRate = 90;
  b.advanced!.prosecutionEfficiency.averageOfficeActionsPerGrantedPatent = 1.5;
  b.advanced!.prosecutionEfficiency.rceRate = 40;
  b.advanced!.prosecutionEfficiency.allowedWithTwoOrFewerActionsRate = 80;
  assert.deepEqual(comparisonReportRows([a, b]).map(comparisonWinner),
    [undefined, undefined, undefined, 0, 1, 0, undefined, 1, 1]);
});
test('missing, tied and visually identical rounded metrics have no winner', () => {
  const a = side('First', 1), b = side('Second', 2);
  assert.ok(comparisonReportRows([a, b]).every((row) => comparisonWinner(row) == null));
  b.advanced!.portfolioInsights.overallAllowanceRate = 80.01;
  assert.equal(comparisonWinner(comparisonReportRows([a, b])[8]), undefined);
  b.advanced = undefined;
  assert.ok(comparisonReportRows([a, b]).every((row) => comparisonWinner(row) == null));
});
test('company display capitalization does not mutate original search identities', () => {
  const a = side('sion power', 1);
  assert.equal(comparisonCompanyLabel(a.portfolio.companyName), 'SION POWER');
  assert.equal(a.portfolio.companyName, 'sion power');
});
test('chart legends place the second company to the right at the same height', () => {
  const a = side('ONE', 1), b = side('TWO', 2);
  a.portfolio.filingTrends = b.portfolio.filingTrends = [];
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const labels: { name: string; x: number; y: number }[] = [];
  const original = pdf.text.bind(pdf);
  pdf.text = ((value: string, x: number, y: number, options: object) => {
    if (value === 'ONE' || value === 'TWO') labels.push({ name: value, x, y });
    return original(value, x, y, options);
  }) as typeof pdf.text;
  drawComparisonCharts(pdf, [a, b], 300);
  assert.equal(labels.length, 4);
  for (let i = 0; i < labels.length; i += 2) {
    assert.equal(labels[i].y, labels[i + 1].y);
    assert.ok(labels[i + 1].x > labels[i].x);
  }
});
