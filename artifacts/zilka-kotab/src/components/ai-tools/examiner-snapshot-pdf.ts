import type { PublicExaminerAnalysis } from '@workspace/api-client-react';
import { drawPortfolioPdfHeader } from './portfolio-pdf-header';

const NAVY: [number, number, number] = [11, 31, 53];
const GOLD: [number, number, number] = [191, 154, 37];
const GRAY: [number, number, number] = [100, 109, 119];
const LIGHT: [number, number, number] = [226, 229, 230];
const num = (value: number | null | undefined) => value == null ? 'N/A' : value.toLocaleString('en-US');
const pct = (value: number | null | undefined) => value == null ? 'N/A' : `${value.toFixed(1)}%`;
const share = (count: number | undefined, total: number | undefined) =>
  count != null && total != null && total > 0 ? count / total * 100 : null;
export const EXAMINER_SNAPSHOT_QUESTIONS = [
  "Are you tailoring prosecution strategy to this examiner's historical allowance patterns, or treating every examiner the same?",
  'When might an interview improve your allowance prospects with this examiner, and are you using interviews strategically?',
  'How does this examiner compare with others in the art unit, and what does that mean for your strategy?',
  'Which path fits this examiner best: continued prosecution, an RCE, an appeal, or a different claim strategy?',
  'How much time and money could examiner-specific intelligence save before your next Office Action?',
] as const;
const clean = (text: string) => text.replace(/[–—]/g, '-').replace(/[“”]/g, '"')
  .replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();

export const examinerSnapshotTitle = (data: PublicExaminerAnalysis) => data.searchType === 'art-unit'
  ? `Art Unit ${data.artUnit ?? data.query}`
  : data.examinerName ?? data.query;

export function examinerInterviewComparison(interview?: PublicExaminerAnalysis['interviewAnalytics']) {
  const available = interview != null && interview.applicationsWithEventData > 0;
  const withDisposed = available ? interview.interviewSummaryAllowed + interview.interviewSummaryAbandoned : 0;
  const withoutDisposed = available ? interview.noSummaryAllowed + interview.noSummaryAbandoned : 0;
  const withRate = share(available ? interview.interviewSummaryAllowed : undefined, withDisposed);
  const withoutRate = share(available ? interview.noSummaryAllowed : undefined, withoutDisposed);
  return {
    withDisposed, withoutDisposed, withRate, withoutRate,
    differencePoints: withRate != null && withoutRate != null ? withRate - withoutRate : null,
    relativeChange: withRate != null && withoutRate != null && withoutRate > 0
      ? (withRate / withoutRate - 1) * 100 : null,
  };
}

/** Branded one-page handout; outcome benchmarks and event cohorts remain distinct. */
export async function createExaminerSnapshotBlob(
  data: PublicExaminerAnalysis,
  footerImageData: string,
): Promise<Blob> {
  if (!footerImageData) throw new Error('The approved handout artwork is required to export this PDF.');
  if (data.selectionRequired) throw new Error('Select a specific examiner before exporting.');
  if (!data.identifiedApplications) throw new Error('No examiner results are available to export.');
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const write = (text: string, x: number, y: number, size = 8, color = NAVY, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size);
    pdf.setTextColor(...color); pdf.text(clean(text), x, y);
  };
  const rule = (y: number) => {
    pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.6); pdf.line(36, y, 576, y);
  };
  const wrap = (text: string, x: number, y: number, width: number, size = 7.5, maxLines = 3) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(...GRAY);
    const lines = pdf.splitTextToSize(clean(text), width) as string[];
    pdf.text(lines.slice(0, maxLines), x, y, { lineHeightFactor: 1.25 });
  };
  const b = data.allowanceBenchmarks;
  const artUnit = data.artUnit ?? b?.artUnit;
  const title = examinerSnapshotTitle(data);
  const subtitle = 'PATENT EXAMINER INTELLIGENCE';
  drawPortfolioPdfHeader(pdf, clean(title), data.coverage.retrievedAt, subtitle);
  const summary = [
    [data.searchType === 'art-unit' ? 'Technology center' : `Art unit${b?.technologyCenter ? ` / TC ${b.technologyCenter}` : ''}`,
      data.searchType === 'art-unit' ? b?.technologyCenter ?? 'N/A' : artUnit ?? 'N/A'],
    ['Applications identified', num(data.identifiedApplications)],
    ['Allowed applications', num(data.allowedApplications)],
    ['Abandoned applications', num(data.abandonedApplications)],
  ];
  summary.forEach(([label, value], index) => {
    const x = 36 + index * 138;
    pdf.setDrawColor(...GOLD); pdf.setLineWidth(2); pdf.line(x, 87, x, 123);
    write(value, x + 10, 105, 22, NAVY, true);
    wrap(label.toUpperCase(), x + 10, 118, 109, 6.5, 2);
  });
  write('EXAMINATION OUTCOMES & ART UNIT CONTEXT', 36, 135, 9.5, NAVY, true);
  rule(142);
  write('ALLOWANCE BENCHMARKS & ABANDONMENT', 36, 156, 6.8, NAVY, true);
  const gauges = [
    { label: data.searchType === 'art-unit' ? 'Art unit allowance rate' : 'Examiner allowance rate',
      rate: data.estimatedAllowanceRate, sample: data.disposedApplications },
    ...(data.searchType === 'examiner' ? [{
      label: `Art unit ${artUnit ?? 'N/A'} allowance`, rate: b?.artUnitAllowanceRate,
      sample: b?.artUnitDisposedApplications,
    }] : []),
    { label: `TC ${b?.technologyCenter ?? 'N/A'} allowance`, rate: b?.technologyCenterAllowanceRate,
      sample: b?.technologyCenterDisposedApplications },
    { label: 'Abandonment rate', rate: share(data.abandonedApplications, data.disposedApplications),
      sample: data.disposedApplications },
  ];
  gauges.forEach((gauge, index) => {
    const x = 36 + 540 / gauges.length * (index + 0.5);
    pdf.setDrawColor(...LIGHT); pdf.setLineWidth(5); pdf.circle(x, 184, 22, 'S');
    if (gauge.rate != null) {
      pdf.setDrawColor(...GOLD);
      const steps = Math.ceil(gauge.rate * 1.2);
      for (let step = 0; step < steps; step++) {
        const a = (-90 + 360 * gauge.rate / 100 * step / steps) * Math.PI / 180;
        const z = (-90 + 360 * gauge.rate / 100 * (step + 1) / steps) * Math.PI / 180;
        pdf.line(x + Math.cos(a) * 22, 184 + Math.sin(a) * 22,
          x + Math.cos(z) * 22, 184 + Math.sin(z) * 22);
      }
    }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...NAVY);
    pdf.text(pct(gauge.rate), x, 188, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...GRAY);
    pdf.text([gauge.label, `(n=${num(gauge.sample)})`], x, 216, { align: 'center', lineHeightFactor: 1.25 });
  });
  rule(238);
  write('OFFICE ACTION BEHAVIOR', 36, 252, 7.2, NAVY, true);
  write('EXAMINER INTERVIEW RECORDS', 322, 252, 7.2, NAVY, true);
  pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.5); pdf.line(303, 248, 303, 342);
  const office = data.officeActionAnalytics;
  const officeSample = office?.applicationsWithEventData ?? 0;
  if (office && officeSample > 0) {
    [
      ['Office action', office.applicationsWithOfficeAction],
      ['Final rejection', office.applicationsWithFinalRejection],
      ['Restriction', office.applicationsWithRestriction],
    ].forEach(([label, count], index) => {
      const y = 272 + index * 23;
      const rate = share(count as number, officeSample)!;
      write(String(label), 36, y, 7);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.3); pdf.setTextColor(...GRAY);
      pdf.text(`${num(count as number)} / ${num(officeSample)} (${pct(rate)})`, 283, y, { align: 'right' });
      pdf.setFillColor(...LIGHT); pdf.rect(36, y + 5, 247, 4, 'F');
      if (rate > 0) { pdf.setFillColor(...(index === 1 ? NAVY : GOLD)); pdf.rect(36, y + 5, 247 * rate / 100, 4, 'F'); }
    });
    write('Applications with the recorded event / event-history sample', 36, 337, 6.1, GRAY);
  } else {
    wrap('Event histories unavailable. Office-action statistics cannot be calculated.', 36, 279, 242);
  }
  const interview = data.interviewAnalytics;
  const comparison = examinerInterviewComparison(interview);
  if (interview && interview.applicationsWithEventData > 0) {
    [
      { label: 'Interview summary found', allowed: interview.interviewSummaryAllowed,
        disposed: comparison.withDisposed, rate: comparison.withRate },
      { label: 'No interview summary located', allowed: interview.noSummaryAllowed,
        disposed: comparison.withoutDisposed, rate: comparison.withoutRate },
    ].forEach((row, index) => {
      const y = 271 + index * 38;
      write(row.label, 322, y, 7);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...NAVY);
      pdf.text(pct(row.rate), 576, y, { align: 'right' });
      write(`Allowed ${num(row.allowed)} / disposed ${num(row.disposed)}`, 322, y + 9, 6.3, GRAY);
      pdf.setFillColor(...LIGHT); pdf.rect(322, y + 15, 254, 4, 'F');
      if (row.rate != null && row.rate > 0) {
        pdf.setFillColor(...(index === 0 ? GOLD : NAVY)); pdf.rect(322, y + 15, 254 * row.rate / 100, 4, 'F');
      }
    });
    const signed = (value: number) => {
      const rounded = Math.round(value * 10) / 10;
      return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`;
    };
    const conclusion = comparison.differencePoints == null ? 'Insufficient disposed outcomes for comparison.'
      : `Observed difference: ${signed(comparison.differencePoints)} pp; relative ${comparison.relativeChange == null ? 'N/A' : `${signed(comparison.relativeChange)}%`}`;
    write(conclusion, 322, 337, 6.1, GRAY);
  } else {
    wrap('Interview summaries unavailable. No outcome comparison can be calculated.', 322, 279, 254);
  }
  rule(346);
  const interviewRate = share(interview?.applicationsWithInterviewSummary, interview?.applicationsWithEventData);
  [
    ['Non-final actions / app', office && officeSample > 0 ? office.averageNonFinalActionsPerApplication.toFixed(2) : 'N/A', `Event n=${num(office?.applicationsWithEventData)}`],
    ['Final actions / app', office && officeSample > 0 ? office.averageFinalActionsPerApplication.toFixed(2) : 'N/A', `Event n=${num(office?.applicationsWithEventData)}`],
    ['Median to first action', office && officeSample > 0 && office.medianMonthsFilingToFirstAction != null ? `${office.medianMonthsFilingToFirstAction.toFixed(1)} mo` : 'N/A', 'Date sample n not reported'],
    ['Interview summary rate', pct(interviewRate), `Event n=${num(interview?.applicationsWithEventData)}`],
  ].forEach(([label, value, sample], index) => {
    const x = 36 + index * 135;
    write(label.toUpperCase(), x, 359, 6.3, NAVY, true);
    write(value, x, 377, 16, NAVY, true);
    write(sample, x, 389, 6.1, GRAY);
    if (index) { pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.5); pdf.line(x - 12, 353, x - 12, 390); }
  });
  const artworkHeight = 612 * 553 / 934;
  const artworkY = 792 - artworkHeight;
  rule(395);
  const scope = `Scope: ${title}${data.searchType === 'examiner' && artUnit ? `; Art Unit ${artUnit}` : ''}. Snapshot: ${num(data.coverage.recordsAnalyzed)} / ${num(data.coverage.totalMatchesReported)} matching records${data.coverage.truncated ? ' (capped)' : ''}.${data.applicationNumberContext ? ` Opened from application ${data.applicationNumberContext}.` : ''} Outcome rates exclude unresolved cases; facet and event cohorts may differ. Benchmarks include the examiner. Interview differences are observational, not causal; no summary found does not prove no interview occurred. Current assignment is not career history. Informational only, not a legal opinion.`;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.3); pdf.setTextColor(...GRAY);
  // Fit all disclosures rather than truncate important evidence limitations.
  let notesSize = 6.3;
  let lines = pdf.splitTextToSize(clean(scope), 540) as string[];
  while (lines.length > 4 && notesSize > 5.5) {
    notesSize -= 0.1; pdf.setFontSize(notesSize);
    lines = pdf.splitTextToSize(clean(scope), 540) as string[];
  }
  if (lines.length > 4) throw new Error('The report notes are too long for the one-page snapshot.');
  const baseline = (395 + artworkY) / 2 + notesSize * (1.075 - 0.299) / 2 - (lines.length - 1) * notesSize * 1.25 / 2;
  pdf.text(lines, 36, baseline, { lineHeightFactor: 1.25 });
  pdf.addImage(footerImageData, 'PNG', 0, artworkY, 612, artworkHeight, 'approved-handout-footer', 'FAST');
  // Replace only the question text. Keep the approved heading, question-mark
  // icons and all firm artwork intact; the portfolio uses the unmodified image.
  const artworkScale = 612 / 934;
  pdf.setFillColor(255, 255, 255);
  pdf.rect(84 * artworkScale, artworkY + 43 * artworkScale,
    830 * artworkScale, 134 * artworkScale, 'F');
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(12, 24, 34);
  EXAMINER_SNAPSHOT_QUESTIONS.forEach((question, index) => {
    pdf.text(question, 87 * artworkScale, artworkY + (62 + index * 25) * artworkScale);
  });
  pdf.link(406, artworkY + 173, 102, 9, { url: 'mailto:britten@zilkakotab.com' });
  pdf.setProperties({ title: `${title} - Intelligence Snapshot`, author: 'Zilka-Kotab PC', subject: 'USPTO examiner and art unit statistics' });
  return pdf.output('blob');
}
