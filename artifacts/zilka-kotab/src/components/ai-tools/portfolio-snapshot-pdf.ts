import type { PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';
import { drawPortfolioPdfHeader } from './portfolio-pdf-header';
import { finishSnapshotWithVectorFooter } from './vector-handout-footer';

const NAVY: [number, number, number] = [11, 31, 53];
const GOLD: [number, number, number] = [191, 154, 37];
const GRAY: [number, number, number] = [100, 109, 119];
const LIGHT: [number, number, number] = [226, 229, 230];

/** A deliberately bounded, US Letter one-page handout, not a full data export. */
export async function createPortfolioSnapshotBlob(
  portfolio: PublicPortfolioAnalysis,
  advanced: PublicPortfolioAdvancedAnalysis | undefined,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
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
  write('PROSECUTION EFFICIENCY', 36, 156, 6.8, NAVY, true);
  if (!advanced) write('Advanced data not available at export time', 347, 156, 6.8, GRAY);
  const gauges = [
    { value: efficiency?.averageOfficeActionsPerGrantedPatent?.toFixed(2) ?? 'N/A', label: 'Avg. office actions per granted patent', rate: undefined, sample: efficiency?.officeActionDenominator },
    { value: percent(efficiency?.rceRate), label: 'RCE Rate', rate: efficiency?.rceRate, sample: efficiency?.rceDenominator },
    { value: percent(efficiency?.examinerInterviewRate), label: 'Examiner Interview Rate', rate: efficiency?.examinerInterviewRate, sample: efficiency?.interviewDenominator },
    { value: percent(efficiency?.allowedWithTwoOrFewerActionsRate), label: 'Allowed with <=2 office actions', rate: efficiency?.allowedWithTwoOrFewerActionsRate, sample: efficiency?.allowedWithHistory },
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
  });
  rule(246);

  // Two compact, comparable data panels.
  write('FILING TREND - LAST FIVE YEARS', 36, 261, 7.2, NAVY, true);
  write('LEADING TECHNOLOGY AREAS', 322, 261, 7.2, NAVY, true);
  pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.5); pdf.line(303, 257, 303, 342);
  const trends = portfolio.filingTrends.slice(-5);
  const maxTrend = Math.max(1, ...trends.map((item) => item.count));
  if (!trends.length) write('Filing dates unavailable', 36, 289, 8, GRAY);
  trends.forEach((item, index) => {
    const x = 45 + index * 48;
    const height = item.count / maxTrend * 43;
    pdf.setFillColor(...(index % 2 ? NAVY : GOLD));
    if (height > 0) pdf.rect(x, 320 - height, 27, height, 'F');
    write(number(item.count), x, 313 - height, 6.5, NAVY, true);
    write(String(item.year), x, 334, 7, GRAY);
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
  const summaryMetrics = [
    ['Allowance rate', percent(insights?.overallAllowanceRate), `Disposed n=${number(insights?.knownFinalOutcomes)}`],
    ['Average time to grant', insights?.averageTimeToGrantMonths == null ? 'N/A' : `${(insights.averageTimeToGrantMonths / 12).toFixed(1)} yrs`, `Valid dates n=${number(insights?.grantDurationSampleSize)}`],
    ['Average pending age', insights?.averagePendingAgeYears == null ? 'N/A' : `${insights.averagePendingAgeYears.toFixed(1)} yrs`, `Pending n=${number(insights?.pendingAgeSampleSize)}`],
    ['Average rate of abandonment', percent(abandonmentRate), `Disposed n=${number(insights?.knownFinalOutcomes)}`],
  ];
  const summaryColumnWidth = 540 / summaryMetrics.length;
  summaryMetrics.forEach(([label, value, sample], index) => {
    const x = 36 + index * summaryColumnWidth;
    write(label.toUpperCase(), x, 359, 6.3, NAVY, true);
    write(value, x, 377, 16, NAVY, true);
    write(sample, x, 389, 6.3, GRAY);
    if (index) { pdf.setDrawColor(...LIGHT); pdf.line(x - 12, 353, x - 12, 390); }
  });
  const artworkHeight = 612 * 553 / 934;
  const artworkY = 792 - artworkHeight;
  const notesTop = 395;
  rule(notesTop);
  const filingRange = efficiency?.filingDateStart && efficiency.filingDateEnd
    ? ` History filing range: ${efficiency.filingDateStart} to ${efficiency.filingDateEnd}.` : '';
  wrapped(
    `Scope: ${portfolio.matchedApplicantNames.join('; ') || portfolio.companyName}. Snapshot sample: ${number(portfolio.coverage.recordsAnalyzed)} / ${number(portfolio.coverage.totalMatchesReported)} matching records.${advanced ? ` Advanced sample: ${number(advanced.coverage.recordsAnalyzed)}${advanced.coverage.truncated ? ' (capped)' : ''}.` : ''}${filingRange} Granted does not confirm in-force status. Filing trends undercount unpublished applications; CPC counts are classification occurrences, not unique patents. Informational only, not a legal opinion.`,
    36, (notesTop + artworkY) / 2, 540, 6.3, GRAY, 4, true,
  );

  pdf.setProperties({ title: `${portfolio.companyName} - Patent Portfolio Snapshot`, author: 'Zilka-Kotab PC', subject: 'USPTO portfolio data snapshot' });
  return finishSnapshotWithVectorFooter(pdf);
}
