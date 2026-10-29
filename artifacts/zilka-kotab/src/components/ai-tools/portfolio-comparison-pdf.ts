import { jsPDF } from 'jspdf';
import { drawPortfolioPdfHeader } from './portfolio-pdf-header';
import { finishSnapshotWithVectorFooter } from './vector-handout-footer';
import { COMPARISON_COLORS, drawComparisonCharts } from './portfolio-comparison-pdf-charts';
import { comparisonReportRows, firmValue, reportNumber, type ComparisonReportSide } from './portfolio-comparison-report-data';

const NAVY: [number, number, number] = [11, 31, 53];
const GRAY: [number, number, number] = [100, 109, 119];
const GOLD: [number, number, number] = [157, 119, 16];
const LIGHT: [number, number, number] = [226, 229, 230];
const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

export async function createPortfolioComparisonBlob(first: ComparisonReportSide, second: ComparisonReportSide): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const sides = [first, second];
  const names = sides.map((s) => clean(s.portfolio.companyName));
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
  const rule = (y: number) => {
    pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.4); pdf.line(36, y, 576, y);
  };
  drawPortfolioPdfHeader(pdf, names.join(' vs. '), first.portfolio.coverage.retrievedAt, 'PATENT PORTFOLIO COMPARISON');
  write('PORTFOLIO AT A GLANCE', 36, 92, 9, NAVY, true);
  pdf.setFillColor(239, 243, 247); pdf.roundedRect(36, 98, 540, 18, 2, 2, 'F');
  write('GENERAL STATISTICS', 42, 109, 6.8, GRAY, true);
  sides.forEach((_, i) => {
    pdf.setFillColor(...COMPARISON_COLORS[i]); pdf.rect(216 + i * 180, 98, 3, 12, 'F');
    const name = names[i];
    let size = 7.5;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size);
    while (pdf.splitTextToSize(name, 170).length > 2 && size > 5.5) {
      size -= 0.25;
      pdf.setFontSize(size);
    }
    wrap(name, 224 + i * 180, 103, 170, size, 2);
  });
  rule(115);
  let y = 116;
  rows.forEach((row, index) => {
    if (index === 3) {
      y += 15;
      write('PROSECUTION EFFICIENCY', 36, y, 9, NAVY, true);
      write('Metric-specific sample sizes shown in parentheses', 339, y, 6, GRAY);
      y += 9;
    }
    const hasBenchmark = row.cells.some((cell) => cell.benchmark);
    const height = index < 3 ? 13 : hasBenchmark ? 21 : 12;
    if (index % 2 === 0) { pdf.setFillColor(247, 249, 250); pdf.rect(36, y, 540, height, 'F'); }
    write(row.label, 42, y + 9, index < 3 ? 7.5 : 7.2);
    row.cells.forEach((cell, side) => {
      const x = 224 + side * 180;
      write(`${cell.value}${cell.sample == null ? '' : ` (n=${reportNumber(cell.sample)})`}`, x, y + 9, index < 3 ? 9 : 7.8, COMPARISON_COLORS[side], true);
      if (cell.benchmark) {
        const b = cell.benchmark;
        pdf.setFillColor(253, 249, 236); pdf.setDrawColor(...GOLD); pdf.setLineWidth(0.5);
        pdf.roundedRect(x - 3, y + 10.5, 172, 9, 1.5, 1.5, 'FD');
        write(`Zilka-Kotab: ${firmValue(b)} | n=${reportNumber(b.denominator)} | cover ${(b.coverage * 100).toFixed(0)}%`, x, y + 17.2, 5.8, GOLD, true);
      }
    });
    y += height;
    rule(y);
  });
  drawComparisonCharts(pdf, sides, y + 8);
  const hasBenchmark = rows.some((row) => row.cells.some((cell) => cell.benchmark));
  sides.forEach((side, index) => {
    const e = side.advanced?.prosecutionEfficiency;
    const range = e?.filingDateStart && e.filingDateEnd ? `; histories ${e.filingDateStart.slice(0, 10)} to ${e.filingDateEnd.slice(0, 10)}` : '';
    write(`${names[index].slice(0, 48)}: ${side.portfolio.matchedApplicantNames.length} applicant names; retrieved ${side.portfolio.coverage.retrievedAt.slice(0, 10)}; ${reportNumber(side.portfolio.coverage.recordsAnalyzed)}/${reportNumber(side.portfolio.coverage.totalMatchesReported)} records; prosecution n=${reportNumber(side.advanced?.coverage.recordsAnalyzed)}${range}.`, 36, 407 + index * 6.5, 5.3, GRAY);
  });
  wrap(
    `${hasBenchmark ? 'Gold: qualifying firm results matched to each company’s technology mix and filing window; cover = matched share. Correspondence association does not prove all historical work. ' : ''}N/A = unavailable/insufficient data. Granted does not mean active. Outcome rates exclude pending. Current year is partial; unpublished filings are absent. Samples differ; no causal inference or legal opinion.`,
    36, 421, 540, 5.5, 2,
  );
  pdf.setProperties({ title: `${names.join(' vs. ')} - Patent Portfolio Comparison`, author: 'Zilka-Kotab PC', subject: 'Consolidated USPTO patent portfolio comparison' });
  // Same native questions, vector branding, original portrait and QR as the analyzer.
  return finishSnapshotWithVectorFooter(pdf);
}
