import { jsPDF } from 'jspdf';
import { drawPortfolioPdfHeader } from './portfolio-pdf-header';
import { finishSnapshotWithVectorFooter } from './vector-handout-footer';
import { drawComparisonCharts } from './portfolio-comparison-pdf-charts';
import { drawComparisonTable } from './portfolio-comparison-pdf-table';
import { comparisonCompanyLabel, comparisonReportRows, reportNumber, type ComparisonReportSide } from './portfolio-comparison-report-data';

const NAVY: [number, number, number] = [11, 31, 53];
const GRAY: [number, number, number] = [100, 109, 119];
const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

export async function createPortfolioComparisonBlob(first: ComparisonReportSide, second: ComparisonReportSide): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const sides = [first, second];
  const names = sides.map((s) => clean(comparisonCompanyLabel(s.portfolio.companyName)));
  const rows = comparisonReportRows(sides);
  const write = (s: string, x: number, y: number, size = 7.5, color = NAVY, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color);
    pdf.text(clean(s), x, y);
  };
  const wrap = (s: string, x: number, y: number, width: number, size: number, maxLines: number) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(...GRAY);
    const lines = pdf.splitTextToSize(clean(s), width) as string[];
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines) {
      let last = shown[maxLines - 1];
      while (last && pdf.getTextWidth(`${last}...`) > width) last = last.slice(0, -1);
      shown[maxLines - 1] = `${last}...`;
    }
    pdf.text(shown, x, y, { lineHeightFactor: 1.15 });
  };
  drawPortfolioPdfHeader(pdf, names.join(' vs. '), first.portfolio.coverage.retrievedAt, 'PATENT PORTFOLIO COMPARISON');
  const tableBottom = drawComparisonTable(pdf, sides);
  drawComparisonCharts(pdf, sides, tableBottom + 16);
  const hasBenchmark = rows.some((row) => row.cells.some((cell) => cell.benchmark));
  sides.forEach((side, index) => {
    const e = side.advanced?.prosecutionEfficiency;
    const range = e?.filingDateStart && e.filingDateEnd ? `; histories ${e.filingDateStart.slice(0, 10)} to ${e.filingDateEnd.slice(0, 10)}` : '';
    write(`${names[index].slice(0, 48)}: ${side.portfolio.matchedApplicantNames.length} applicant names; retrieved ${side.portfolio.coverage.retrievedAt.slice(0, 10)}; ${reportNumber(side.portfolio.coverage.recordsAnalyzed)}/${reportNumber(side.portfolio.coverage.totalMatchesReported)} records; history sample: ${reportNumber(side.advanced?.coverage.recordsAnalyzed)}${range}.`, 36, 407 + index * 6.5, 5.3, GRAY);
  });
  wrap(
    `Tint: favorable observed efficiency; neutral metrics/ties unranked. ${hasBenchmark ? 'Gold: firm results matched separately by technology mix/filing window; correspondence does not prove all historical work. ' : ''}Dash: no qualifying firm result. N/A: insufficient data. Granted is not active. Outcomes exclude pending. Current year partial; unpublished filings absent. Samples differ. No causal inference or legal opinion.`,
    36, 421, 540, 5.5, 2,
  );
  pdf.setProperties({ title: `${names.join(' vs. ')} - Patent Portfolio Comparison`, author: 'Zilka-Kotab PC', subject: 'Consolidated USPTO patent portfolio comparison' });
  // Same native questions, vector branding, original portrait and QR as the analyzer.
  return finishSnapshotWithVectorFooter(pdf);
}
