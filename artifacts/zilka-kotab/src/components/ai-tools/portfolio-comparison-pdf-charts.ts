import type { jsPDF } from 'jspdf';
import { reportNumber, type ComparisonReportSide } from './portfolio-comparison-report-data';

export const COMPARISON_COLORS: [number, number, number][] = [[34, 69, 108], [21, 111, 123]];
const GRAY: [number, number, number] = [100, 109, 119];
const LIGHT: [number, number, number] = [226, 229, 230];
const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

/** Two full-scope yearly count charts; missing data is never inferred from recent-grant samples. */
export function drawComparisonCharts(pdf: jsPDF, sides: readonly ComparisonReportSide[], top: number) {
  const text = (value: string, x: number, y: number, size = 6.5, color = GRAY, align: 'left' | 'center' | 'right' = 'left') => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color);
    pdf.text(clean(value), x, y, { align });
  };
  (['filingTrends', 'grantTrends'] as const).forEach((field, chartIndex) => {
    const left = chartIndex === 0 ? 36 : 322;
    text(chartIndex === 0 ? 'FILING TREND' : 'GRANT TREND', left, top, 8, COMPARISON_COLORS[0]);
    sides.forEach((s, i) => {
      pdf.setFillColor(...COMPARISON_COLORS[i]); pdf.rect(left, top + 7 + i * 15, 6, 5, 'F');
      pdf.setFontSize(6.2);
      const lines = pdf.splitTextToSize(clean(s.portfolio.companyName), 238) as string[];
      pdf.setTextColor(...COMPARISON_COLORS[i]);
      pdf.text(lines.slice(0, 2), left + 10, top + 12 + i * 15, { lineHeightFactor: 1.05 });
    });
    const series = sides.map((s) => s.portfolio[field] ?? []);
    const years = [...new Set(series.flatMap((points) => points.map((t) => t.year)))].sort((a, b) => a - b).slice(-5);
    const values = series.map((points) => new Map(points.map((t) => [t.year, t.count])));
    const max = Math.max(1, ...values.flatMap((map) => years.map((year) => map.get(year) ?? 0)));
    const bottom = 393;
    const plotTop = top + 42;
    const height = bottom - plotTop;
    const plotX = left + 22, width = 228;
    pdf.setDrawColor(...LIGHT); pdf.setLineWidth(0.4);
    for (let tick = 0; tick <= 2; tick++) {
      const y = bottom - tick / 2 * height;
      pdf.line(plotX, y, plotX + width, y);
      text(reportNumber(Math.round(max * tick / 2)), plotX - 5, y + 2, 5.5, GRAY, 'right');
    }
    if (!years.length) { text('Yearly data unavailable', plotX + 25, plotTop + height / 2, 7); return; }
    const step = width / years.length;
    years.forEach((year, index) => {
      const center = plotX + (index + 0.5) * step;
      text(String(year), center, bottom + 9, 6.2, GRAY, 'center');
      sides.forEach((_, side) => {
        const value = values[side].get(year);
        const x = center - 14 + side * 15;
        if (value == null) { text('N/A', x + 6, bottom - 3, 4.8, GRAY, 'center'); return; }
        const barHeight = value / max * height;
        pdf.setFillColor(...COMPARISON_COLORS[side]);
        if (barHeight > 0) pdf.rect(x, bottom - barHeight, 12, barHeight, 'F');
        text(reportNumber(value), x + 6, bottom - barHeight - 3, 5.1, GRAY, 'center');
      });
    });
  });
}
