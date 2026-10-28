import type { PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';

const NAVY: [number, number, number] = [11, 31, 53];
const GOLD: [number, number, number] = [191, 154, 37];
const GRAY: [number, number, number] = [100, 109, 119];
const LIGHT: [number, number, number] = [226, 229, 230];

/** A deliberately bounded, US Letter one-page handout, not a full data export. */
export async function createPortfolioSnapshotBlob(
  portfolio: PublicPortfolioAnalysis,
  advanced?: PublicPortfolioAdvancedAnalysis,
  portraitData?: string,
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
  const wrapped = (s: string, x: number, y: number, width: number, size = 8, color = GRAY, maxLines = 3) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(clean(s), width) as string[];
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) shown[maxLines - 1] = fit(`${shown[maxLines - 1]}...`, width, size);
    pdf.text(shown, x, y, { lineHeightFactor: 1.25 });
  };
  const rule = (y: number, x1 = 36, x2 = 576) => {
    pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.6); pdf.line(x1, y, x2, y);
  };
  const metric = (label: string, value: string, x: number, y: number, width: number) => {
    pdf.setDrawColor(...GOLD); pdf.setLineWidth(2); pdf.line(x, y, x, y + 36);
    write(fit(value, width - 14, 22), x + 10, y + 18, 22, NAVY, true);
    wrapped(label.toUpperCase(), x + 10, y + 31, width - 17, 6.5, GRAY, 2);
  };

  // Header. No event branding, event date, advice, or outside-counsel content.
  pdf.setFillColor(...NAVY); pdf.rect(0, 0, 612, 70, 'F');
  pdf.setFillColor(...GOLD); pdf.rect(0, 70, 612, 2, 'F');
  pdf.setFont('times', 'normal'); pdf.setFontSize(23); pdf.setTextColor(255, 255, 255);
  const company = fit(portfolio.companyName, 540, 23);
  pdf.text(company, 36, 30);
  write('PATENT PORTFOLIO SNAPSHOT', 36, 48, 8, [255, 255, 255], true);
  const date = new Date(portfolio.coverage.retrievedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  write(`USPTO Open Data Portal  |  Retrieved ${date}`, 36, 61, 7, [204, 213, 223]);
  [
    ['Granted - status unverified', number(portfolio.identifiedGrantedPatents)],
    ['Identified pending', number(portfolio.identifiedPendingApplications)],
    ['Expired / inactive identified', number(portfolio.expiredInactivePatents)],
    ['Grants in last 12 months', number(portfolio.recentGrantCount)],
  ].forEach(([label, value], index) => metric(label, value, 36 + index * 138, 87, 126));

  write('PORTFOLIO COMPOSITION & PROSECUTION', 36, 148, 9.5, NAVY, true);
  rule(155);
  const efficiency = advanced?.prosecutionEfficiency;
  write('PROSECUTION EFFICIENCY', 36, 171, 6.8, GRAY, true);
  write(advanced ? `Histories n=${number(efficiency?.applicationsWithHistories)}` : 'Advanced data not available at export time', 347, 171, 6.8, GRAY);
  const gauges = [
    { value: efficiency?.averageOfficeActionsPerGrantedPatent?.toFixed(2) ?? 'N/A', label: 'Avg. office actions per granted patent', rate: undefined, sample: efficiency?.officeActionDenominator },
    { value: percent(efficiency?.rceRate), label: 'Applications with an RCE', rate: efficiency?.rceRate, sample: efficiency?.rceDenominator },
    { value: percent(efficiency?.examinerInterviewRate), label: 'Documented interview rate', rate: efficiency?.examinerInterviewRate, sample: efficiency?.interviewDenominator },
    { value: percent(efficiency?.allowedWithTwoOrFewerActionsRate), label: 'Allowed with <=2 office actions', rate: efficiency?.allowedWithTwoOrFewerActionsRate, sample: efficiency?.allowedWithHistory },
  ];
  gauges.forEach((gauge, index) => {
    const x = 101 + index * 137;
    pdf.setDrawColor(...LIGHT); pdf.setLineWidth(5); pdf.circle(x, 201, 22, 'S');
    if (index === 0 && efficiency?.averageOfficeActionsPerGrantedPatent != null) {
      // The average is a number, not a proportion: a thin outline, not a filled share.
      pdf.setDrawColor(...NAVY); pdf.setLineWidth(1); pdf.circle(x, 201, 22, 'S');
    } else if (gauge.rate != null) {
      pdf.setDrawColor(...GOLD); pdf.setLineWidth(5);
      const steps = Math.max(1, Math.ceil(gauge.rate * 1.2));
      for (let segment = 0; segment < steps; segment++) {
        const a = (-90 + 360 * (gauge.rate / 100) * segment / steps) * Math.PI / 180;
        const b = (-90 + 360 * (gauge.rate / 100) * (segment + 1) / steps) * Math.PI / 180;
        pdf.line(x + Math.cos(a) * 22, 201 + Math.sin(a) * 22, x + Math.cos(b) * 22, 201 + Math.sin(b) * 22);
      }
    }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...NAVY);
    pdf.text(gauge.value, x, 205, { align: 'center' });
    wrapped(gauge.label, x - 52, 235, 110, 7, GRAY, 2);
    write(`n=${number(gauge.sample)}`, x - 52, 259, 6.3, GRAY);
  });
  rule(267);

  // Two compact, comparable data panels.
  write('FILING TREND - LAST FIVE YEARS', 36, 283, 7.2, NAVY, true);
  write('LEADING TECHNOLOGY AREAS', 322, 283, 7.2, NAVY, true);
  pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.5); pdf.line(303, 279, 303, 369);
  const trends = portfolio.filingTrends.slice(-5);
  const maxTrend = Math.max(1, ...trends.map((item) => item.count));
  if (!trends.length) write('Filing dates unavailable', 36, 311, 8, GRAY);
  trends.forEach((item, index) => {
    const x = 45 + index * 48;
    const height = item.count / maxTrend * 43;
    pdf.setFillColor(...(index % 2 ? NAVY : GOLD));
    if (height > 0) pdf.rect(x, 347 - height, 27, height, 'F');
    write(number(item.count), x, 340 - height, 6.5, NAVY, true);
    write(String(item.year), x, 361, 7, GRAY);
  });
  const technology = portfolio.topTechnologyAreas.slice(0, 3);
  const maxTechnology = Math.max(1, ...technology.map((item) => item.count));
  if (!technology.length) write('Classification data unavailable', 322, 311, 8, GRAY);
  technology.forEach((item, index) => {
    const y = 301 + index * 24;
    write(fit(`${item.code}  ${item.label}`, 205, 7), 322, y, 7, NAVY);
    write(number(item.count), 550, y, 7, GRAY);
    pdf.setFillColor(...LIGHT); pdf.rect(322, y + 5, 219, 4, 'F');
    pdf.setFillColor(...(index % 2 ? NAVY : GOLD)); pdf.rect(322, y + 5, 219 * item.count / maxTechnology, 4, 'F');
  });
  rule(374);
  const insights = advanced?.portfolioInsights;
  [
    ['Allowance rate', percent(insights?.overallAllowanceRate), `Disposed n=${number(insights?.knownFinalOutcomes)}`],
    ['Average time to grant', insights?.averageTimeToGrantMonths == null ? 'N/A' : `${(insights.averageTimeToGrantMonths / 12).toFixed(1)} yrs`, `Valid dates n=${number(insights?.grantDurationSampleSize)}`],
    ['Average pending age', insights?.averagePendingAgeYears == null ? 'N/A' : `${insights.averagePendingAgeYears.toFixed(1)} yrs`, `Pending n=${number(insights?.pendingAgeSampleSize)}`],
  ].forEach(([label, value, sample], index) => {
    const x = 36 + index * 184;
    write(label.toUpperCase(), x, 388, 6.3, GRAY, true);
    write(value, x, 408, 16, NAVY, true);
    write(sample, x, 420, 6.3, GRAY);
    if (index) { pdf.setDrawColor(...LIGHT); pdf.line(x - 12, 383, x - 12, 421); }
  });
  const filingRange = efficiency?.filingDateStart && efficiency.filingDateEnd
    ? ` History filing range: ${efficiency.filingDateStart} to ${efficiency.filingDateEnd}.` : '';
  wrapped(
    `Scope: ${portfolio.matchedApplicantNames.join('; ') || portfolio.companyName}. Snapshot sample: ${number(portfolio.coverage.recordsAnalyzed)} / ${number(portfolio.coverage.totalMatchesReported)} matching records.${advanced ? ` Advanced sample: ${number(advanced.coverage.recordsAnalyzed)}${advanced.coverage.truncated ? ' (capped)' : ''}.` : ''}${filingRange}`,
    36, 436, 540, 6.3, GRAY, 2,
  );
  wrapped('Granted does not confirm in-force status. Filing trends undercount unpublished applications; CPC counts are classification occurrences, not unique patents. Informational only, not a legal opinion.', 36, 456, 540, 6.3, GRAY, 2);

  // The bottom 40% is reserved for the firm's supplied brand and practice copy.
  const firmY = 475;
  pdf.setFillColor(...GOLD); pdf.rect(0, firmY, 612, 3, 'F');
  pdf.setFillColor(...NAVY); pdf.rect(0, firmY + 3, 612, 100, 'F');
  pdf.setFont('times', 'bold'); pdf.setFontSize(21); pdf.setTextColor(255, 255, 255);
  pdf.text('ZILKA-KOTAB PC', 36, firmY + 27);
  write('I N T E L L E C T U A L   P R O P E R T Y   L A W', 37, firmY + 40, 6.6, GOLD);
  write('Patents engineered for absolute precision.', 36, firmY + 57, 9.2, [255, 255, 255], true);
  wrapped('We build IP portfolios that survive boardroom scrutiny and courtroom battles. Trusted by the architects of tomorrow\'s technology.', 36, firmY + 71, 323, 7.7, [216, 223, 230], 3);
  if (portraitData) {
    pdf.addImage(portraitData, 'PNG', 384, firmY + 20, 60, 60);
    pdf.setDrawColor(...GOLD); pdf.setLineWidth(1.5); pdf.rect(384, firmY + 20, 60, 60, 'S');
  }
  write('Britten Sessions', 457, firmY + 40, 8, GOLD, true);
  write('Managing Partner', 457, firmY + 53, 7.2, [255, 255, 255]);
  write('britten@zilkakotab.com', 457, firmY + 65, 6.3, [216, 223, 230]);
  pdf.link(457, firmY + 55, 119, 13, { url: 'mailto:britten@zilkakotab.com' });

  const features = [
    ['AI', 'AI-INTEGRATED PRACTICE', 'Leading AI tools, applied for higher quality and faster turnarounds.'],
    ['IP', 'STRATEGIC FIRST', 'IP aligned to business goals, building portfolios that drive value.'],
    ['G', 'GLOBAL PERSPECTIVE', 'Deep experience protecting innovation wherever it matters most.'],
    ['P', 'PARTNER-LED ATTENTION', 'You work directly with seasoned attorneys invested in your success.'],
    ['Q', 'QUALITY THAT HOLDS UP', 'Rigorous drafting and prosecution built to withstand challenges.'],
    ['V', 'SPEED. RESULTS. VALUE.', 'Better outcomes, controlled costs, maximum return on IP investment.'],
  ];
  features.forEach(([icon, title, body], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 36 + col * 184;
    const y = firmY + 125 + row * 69;
    pdf.setDrawColor(...GOLD); pdf.setLineWidth(0.8); pdf.circle(x + 9, y + 4, 9, 'S');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(...NAVY); pdf.text(icon, x + 9, y + 6, { align: 'center' });
    write(title, x + 25, y, 6.5, NAVY, true);
    wrapped(body, x + 25, y + 13, 139, 7.1, GRAY, 4);
    if (col) { pdf.setDrawColor(...LIGHT); pdf.line(x - 12, y - 12, x - 12, y + 44); }
  });
  pdf.setFillColor(...NAVY); pdf.rect(0, 731, 612, 61, 'F');
  write('REAL RESULTS.', 36, 751, 7.3, GOLD, true);
  write('REAL RETURNS.', 36, 762, 7.3, GOLD, true);
  [
    ['HUNDREDS OF MILLIONS', 'IN IP RETURNS'],
    ['PATENTS LICENSED TO', 'FORTUNE 100/500 COMPANIES'],
    ['FEDERAL CIRCUIT WINS', '& JURY VERDICTS'],
  ].forEach(([line1, line2], index) => {
    const x = 155 + index * 144;
    write(line1, x, 751, 6.2, [255, 255, 255], true);
    write(line2, x, 762, 6.2, [255, 255, 255], true);
  });
  write('zilkakotab.com', 36, 781, 6.5, [203, 213, 223]);
  pdf.link(36, 773, 100, 12, { url: 'https://zilkakotab.com' });
  pdf.setProperties({ title: `${portfolio.companyName} - Patent Portfolio Snapshot`, author: 'Zilka-Kotab PC', subject: 'USPTO portfolio data snapshot' });
  return pdf.output('blob');
}
