import type { PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';
import { jsPDF } from 'jspdf';
import { drawPortfolioPdfHeader } from './portfolio-pdf-header';
import { finishSnapshotWithVectorFooter } from './vector-handout-footer';
import { benchmarkValue, findLine, hasLines } from './firm-benchmark';

const NAVY: [number, number, number] = [11, 31, 53];
const GOLD: [number, number, number] = [191, 154, 37];
const GRAY: [number, number, number] = [100, 109, 119];
const LIGHT: [number, number, number] = [226, 229, 230];

/** A deliberately bounded, US Letter one-page handout, not a full data export. */
export async function createPortfolioSnapshotBlob(
  portfolio: PublicPortfolioAnalysis,
  advanced: PublicPortfolioAdvancedAnalysis | undefined,
): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/[≤]/g, '<=')
    .replace(/[“”]/g, '"').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  const number = (n: number | null | undefined) => n == null ? 'N/A' : n.toLocaleString('en-US');
  const percent = (n: number | null | undefined) => n == null ? 'N/A' : `${n.toFixed(1)}%`;
  const write = (s: string, x: number, y: number, size = 9, color = NAVY, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.text(clean(s), x, y);
  };
  const fit = (s: string, maxWidth: number, size: number) => {
    pdf.setFontSize(size);
    let result = clean(s);
    if (pdf.getTextWidth(result) <= maxWidth) return result;
    while (result.length && pdf.getTextWidth(`${result}...`) > maxWidth) result = result.slice(0, -1);
    return `${result}...`;
  };
  const wrapped = (s: string, x: number, y: number, width: number, size = 8, color = GRAY, maxLines = 3, centerVertically = false) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(clean(s), width) as string[];
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) shown[maxLines - 1] = fit(`${shown[maxLines - 1]}...`, width, size);
    // Helvetica's ascender/descender are 1.075/0.299 em. Account for these
    // as well as line spacing so the whole block, not its baseline, is centered.
    const baseline = centerVertically
      ? y + size * (1.075 - 0.299) / 2 - (shown.length - 1) * size * 1.25 / 2
      : y;
    pdf.text(shown, x, baseline, { lineHeightFactor: 1.25 });
  };
  const rule = (y: number, x1 = 36, x2 = 576) => {
    pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.6); pdf.line(x1, y, x2, y);
  };
  const metric = (label: string, value: string, x: number, y: number, width: number) => {
    pdf.setDrawColor(...GOLD); pdf.setLineWidth(2); pdf.line(x, y, x, y + 36);
    write(fit(value, width - 14, 22), x + 10, y + 18, 22, NAVY, true);
    wrapped(label.toUpperCase(), x + 10, y + 31, width - 17, 6.5, GRAY, 2);
  };

  drawPortfolioPdfHeader(pdf, clean(portfolio.companyName), portfolio.coverage.retrievedAt);
  [
    ['Granted - status unverified', number(portfolio.identifiedGrantedPatents)],
    ['Identified pending', number(portfolio.identifiedPendingApplications)],
    ['Expired / inactive identified', number(portfolio.expiredInactivePatents)],
    ['Grants in last 12 months', number(portfolio.recentGrantCount)],
  ].forEach(([label, value], index) => metric(label, value, 36 + index * 138, 87, 126));

  write('PORTFOLIO COMPOSITION & DOCKET CONCENTRATION', 36, 135, 9.5, NAVY, true);
  rule(142);
  const efficiency = advanced?.prosecutionEfficiency;
  const fb = advanced?.firmBenchmark;
  const benchText = (metric: Parameters<typeof findLine>[1]) => {
    const line = findLine(fb, metric);
    return line ? `Zilka-Kotab: ${benchmarkValue(line)} (n=${number(line.denominator)})` : null;
  };
  if (fb && fb.excludedApplications > 0) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.3); pdf.setTextColor(...GOLD);
    pdf.text(fit(`${number(fb.excludedApplications)} of ${number(fb.companyApplications)} applications prosecuted by Zilka-Kotab`, 250, 6.3), 576, 135, { align: 'right' });
  }
  write('PROSECUTION EFFICIENCY', 36, 156, 6.8, NAVY, true);
  if (!advanced) write('Advanced data not available at export time', 347, 156, 6.8, GRAY);
  const gauges = [
    { value: efficiency?.averageOfficeActionsPerGrantedPatent?.toFixed(2) ?? 'N/A', label: 'Avg. office actions per granted patent', rate: undefined, sample: efficiency?.officeActionDenominator, bench: benchText('officeActionsPerPatent') },
    { value: percent(efficiency?.rceRate), label: 'RCE Rate', rate: efficiency?.rceRate, sample: efficiency?.rceDenominator, bench: benchText('rceRate') },
    { value: percent(efficiency?.examinerInterviewRate), label: 'Examiner Interview Rate', rate: efficiency?.examinerInterviewRate, sample: efficiency?.interviewDenominator, bench: null },
    { value: percent(efficiency?.allowedWithTwoOrFewerActionsRate), label: 'Allowed with <=2 office actions', rate: efficiency?.allowedWithTwoOrFewerActionsRate, sample: efficiency?.allowedWithHistory, bench: benchText('allowedWithTwoActionsRate') },
  ];
  gauges.forEach((gauge, index) => {
    const x = 101 + index * 137;
    pdf.setDrawColor(...LIGHT); pdf.setLineWidth(5); pdf.circle(x, 184, 22, 'S');
    if (index === 0 && efficiency?.averageOfficeActionsPerGrantedPatent != null) {
      // The average is a number, not a proportion: a thin outline, not a filled share.
      pdf.setDrawColor(...NAVY); pdf.setLineWidth(1); pdf.circle(x, 184, 22, 'S');
    } else if (gauge.rate != null) {
      pdf.setDrawColor(...GOLD); pdf.setLineWidth(5);
      const steps = Math.max(1, Math.ceil(gauge.rate * 1.2));
      for (let segment = 0; segment < steps; segment++) {
        const a = (-90 + 360 * (gauge.rate / 100) * segment / steps) * Math.PI / 180;
        const b = (-90 + 360 * (gauge.rate / 100) * (segment + 1) / steps) * Math.PI / 180;
        pdf.line(x + Math.cos(a) * 22, 184 + Math.sin(a) * 22, x + Math.cos(b) * 22, 184 + Math.sin(b) * 22);
      }
    }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...NAVY);
    pdf.text(gauge.value, x, 188, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...GRAY);
    pdf.text([clean(gauge.label), `(n=${number(gauge.sample)})`], x, 216, {
      align: 'center', lineHeightFactor: 1.25,
    });
    if (gauge.bench) {
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...GOLD);
      pdf.text(fit(gauge.bench, 130, 5.4), x, 233.5, { align: 'center' });
    }
  });
  const showFootnote = hasLines(fb) && fb;
  if (showFootnote) wrapped(fb.footnote, 36, 246, 540, 5.7, GRAY, 2);
  rule(showFootnote ? 259 : 246);

  // Two compact, comparable data panels.
  write('FILING TREND - LAST FIVE YEARS', 36, showFootnote ? 267 : 261, 7.2, NAVY, true);
  write('LEADING TECHNOLOGY AREAS', 322, showFootnote ? 267 : 261, 7.2, NAVY, true);
  pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.5); pdf.line(303, 257, 303, 342);
  const trends = portfolio.filingTrends.slice(-5);
  const maxTrend = Math.max(1, ...trends.map((item) => item.count));
  if (!trends.length) write('Filing dates unavailable', 36, 289, 8, GRAY);
  trends.forEach((item, index) => {
    const x = 45 + index * 48;
    const height = item.count / maxTrend * 43;
    pdf.setFillColor(...(index % 2 ? NAVY : GOLD));
    if (height > 0) pdf.rect(x, 320 + (showFootnote ? 7 : 0) - height, 27, height, 'F');
    write(number(item.count), x, 313 + (showFootnote ? 7 : 0) - height, 6.5, NAVY, true);
    write(String(item.year), x, 334 + (showFootnote ? 7 : 0), 7, GRAY);
  });
  const technology = portfolio.topTechnologyAreas.slice(0, 3);
  const maxTechnology = Math.max(1, ...technology.map((item) => item.count));
  if (!technology.length) write('Classification data unavailable', 322, 289, 8, GRAY);
  technology.forEach((item, index) => {
    const y = 278 + index * 24;
    write(fit(`${item.code}  ${item.label}`, 205, 7), 322, y, 7, NAVY);
    write(number(item.count), 550, y, 7, GRAY);
    pdf.setFillColor(...LIGHT); pdf.rect(322, y + 5, 219, 4, 'F');
    pdf.setFillColor(...(index % 2 ? NAVY : GOLD)); pdf.rect(322, y + 5, 219 * item.count / maxTechnology, 4, 'F');
  });
  rule(346);
  const insights = advanced?.portfolioInsights;
  // Allowance uses allowed / (allowed + abandoned); pending is excluded.
  const abandonmentRate = insights?.overallAllowanceRate != null && insights.knownFinalOutcomes > 0
    ? 100 - insights.overallAllowanceRate : null;
  const summaryMetrics: [string, string, string, string | null][] = [
    ['Allowance rate', percent(insights?.overallAllowanceRate), `Disposed n=${number(insights?.knownFinalOutcomes)}`, benchText('allowanceRate')],
    ['Average time to grant', insights?.averageTimeToGrantMonths == null ? 'N/A' : `${(insights.averageTimeToGrantMonths / 12).toFixed(1)} yrs`, `Valid dates n=${number(insights?.grantDurationSampleSize)}`, benchText('timeToGrantYears')],
    ['Average pending age', insights?.averagePendingAgeYears == null ? 'N/A' : `${insights.averagePendingAgeYears.toFixed(1)} yrs`, `Pending n=${number(insights?.pendingAgeSampleSize)}`, null],
    ['Average rate of abandonment', percent(abandonmentRate), `Disposed n=${number(insights?.knownFinalOutcomes)}`, null],
  ];
  // When benchmark lines exist, tighten the row by 2pt so a compact line fits above the notes.
  const summaryBench = summaryMetrics.some((item) => item[3]);
  const shift = summaryBench ? 2 : 0;
  const summaryColumnWidth = 540 / summaryMetrics.length;
  summaryMetrics.forEach(([label, value, sample, bench], index) => {
    const x = 36 + index * summaryColumnWidth;
    write(label.toUpperCase(), x, 359, 6.3, NAVY, true);
    write(value, x, 377 - shift, 16, NAVY, true);
    write(sample, x, 389 - shift - (summaryBench ? 1 : 0), 6.3, GRAY);
    if (bench) {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(5.4); pdf.setTextColor(...GOLD);
      pdf.text(fit(bench, summaryColumnWidth - 16, 5.4), x, 395);
    }
    if (index) { pdf.setDrawColor(...LIGHT); pdf.line(x - 12, 353, x - 12, summaryBench ? 397 : 390); }
  });
  const artworkHeight = 612 * 553 / 934;
  const artworkY = 792 - artworkHeight;
  const notesTop = summaryBench ? 400 : 395;
  rule(notesTop);
  const filingRange = efficiency?.filingDateStart && efficiency.filingDateEnd
    ? ` History filing range: ${efficiency.filingDateStart} to ${efficiency.filingDateEnd}.` : '';
  wrapped(
    `Scope: ${portfolio.matchedApplicantNames.join('; ') || portfolio.companyName}. Snapshot sample: ${number(portfolio.coverage.recordsAnalyzed)} / ${number(portfolio.coverage.totalMatchesReported)} matching records.${advanced ? ` Advanced sample: ${number(advanced.coverage.recordsAnalyzed)}${advanced.coverage.truncated ? ' (systematic full-range sample)' : ''}.` : ''}${filingRange}${fb && fb.excludedApplications > 0 ? ' Firm count: correspondence numbers in analyzed sample, not proof of all work.' : ''} Granted does not confirm in-force status. Filing trends undercount unpublished applications; CPC counts are classification occurrences, not unique patents. Informational only, not a legal opinion.`,
    36, (notesTop + artworkY) / 2, 540, 6.3, GRAY, 4, true,
  );

  pdf.setProperties({ title: `${portfolio.companyName} - Patent Portfolio Snapshot`, author: 'Zilka-Kotab PC', subject: 'USPTO portfolio data snapshot' });
  return finishSnapshotWithVectorFooter(pdf);
}
