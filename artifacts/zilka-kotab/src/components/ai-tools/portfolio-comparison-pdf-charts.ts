import type { jsPDF } from 'jspdf';
import { comparisonBenchmark, reportNumber, reportPercent, type ComparisonReportSide } from './portfolio-comparison-report-data';

export const COMPARISON_COLORS: [number, number, number][] = [[34, 69, 108], [21, 111, 123]];
const GOLD: [number, number, number] = [191, 154, 37];
const GRAY: [number, number, number] = [100, 109, 119];
const LIGHT: [number, number, number] = [226, 229, 230];

/** Native vectors: grouped counts share one axis; allowance bars share a 0-100% axis. */
export function drawComparisonCharts(pdf: jsPDF, sides: readonly ComparisonReportSide[], top: number) {
  const text = (value: string, x: number, y: number, size = 6.5, color = GRAY, align: 'left' | 'center' | 'right' = 'left') => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color);
    pdf.text(value, x, y, { align });
  };
  const heading = (value: string, x: number) => {
    text(value, x, top, 7.2, COMPARISON_COLORS[0]);
  };
  heading('FILING TREND - LAST FIVE REPORTED YEARS', 36);
  heading('ALLOWANCE RATE - KNOWN OUTCOMES', 322);
  sides.forEach((_, i) => {
    pdf.setFillColor(...COMPARISON_COLORS[i]); pdf.rect(36 + i * 106, top + 6, 7, 5, 'F');
    text(`${i === 0 ? 'A' : 'B'} (as in table above)`, 47 + i * 106, top + 11, 6);
  });
  text('Gold marker: qualifying matched Zilka-Kotab rate', 322, top + 11, 5.8);
  const years = [...new Set(sides.flatMap((s) => s.portfolio.filingTrends.map((t) => t.year)))].sort((a, b) => a - b).slice(-5);
  const values = sides.map((s) => new Map(s.portfolio.filingTrends.map((t) => [t.year, t.count])));
  const max = Math.max(1, ...values.flatMap((map) => years.map((year) => map.get(year) ?? 0)));
  const bottom = top + 62;
  const height = 37;
  pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.4); pdf.line(54, bottom, 282, bottom);
  text('0', 49, bottom + 2, 5.5, GRAY, 'right');
  text(reportNumber(max), 49, bottom - height, 5.5, GRAY, 'right');
  if (!years.length) text('Filing dates unavailable', 70, top + 40, 7);
  const step = 226 / Math.max(1, years.length);
  years.forEach((year, index) => {
    const center = 54 + (index + 0.5) * step;
    text(String(year), center, bottom + 9, 6.2, GRAY, 'center');
    sides.forEach((_, side) => {
      const value = values[side].get(year);
      const x = center - 14 + side * 15;
      // A missing year is not a confirmed zero.
      if (value == null) { text('N/A', x + 6, bottom - 3, 4.8, GRAY, 'center'); return; }
      const barHeight = value / max * height;
      pdf.setFillColor(...COMPARISON_COLORS[side]);
      if (barHeight > 0) pdf.rect(x, bottom - barHeight, 12, barHeight, 'F');
      text(reportNumber(value), x + 6, bottom - barHeight - 3, 5, GRAY, 'center');
    });
  });
  const barX = 342, barWidth = 186;
  sides.forEach((side, index) => {
    const y = top + 23 + index * 22;
    const rate = side.advanced?.portfolioInsights.overallAllowanceRate;
    text(index === 0 ? 'A' : 'B', 322, y + 6, 7, COMPARISON_COLORS[index]);
    if (rate == null) { text('N/A', barX, y + 6, 7); return; }
    pdf.setFillColor(...LIGHT); pdf.rect(barX, y, barWidth, 7, 'F');
    pdf.setFillColor(...COMPARISON_COLORS[index]);
    if (rate > 0) pdf.rect(barX, y, barWidth * rate / 100, 7, 'F');
    text(reportPercent(rate), 576, y + 6, 7.2, COMPARISON_COLORS[index], 'right');
    const benchmark = comparisonBenchmark(side, 'allowanceRate', rate, true);
    if (benchmark) {
      pdf.setDrawColor(...GOLD); pdf.setLineWidth(2);
      const x = barX + barWidth * benchmark.value / 100;
      pdf.line(x, y - 2, x, y + 9);
    }
  });
  text('0%', barX, bottom + 9, 6);
  text('100%', barX + barWidth, bottom + 9, 6, GRAY, 'right');
}
