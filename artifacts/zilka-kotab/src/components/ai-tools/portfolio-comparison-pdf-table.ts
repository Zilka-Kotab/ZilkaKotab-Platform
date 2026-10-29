import type { jsPDF } from 'jspdf';
import { comparisonReportRows, firmValue, type ComparisonReportSide } from './portfolio-comparison-report-data';
import { COMPARISON_COLORS } from './portfolio-comparison-pdf-charts';

const NAVY: [number, number, number] = [11, 31, 53];
const GOLD: [number, number, number] = [157, 119, 16];
const GRID: [number, number, number] = [213, 220, 227];
const COLUMNS = [36, 114, 284, 366, 430, 512, 576] as const;
const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

/** Six columns; the section cells span their rows and firm values stay independently matched. */
export function drawComparisonTable(pdf: jsPDF, sides: readonly ComparisonReportSide[]) {
  const top = 94, headerHeight = 30, rowHeight = 18, bodyTop = top + headerHeight;
  const rows = comparisonReportRows(sides);
  const bottom = bodyTop + rows.length * rowHeight;
  const text = (value: string, x: number, y: number, size = 8, color = NAVY, bold = false, align: 'left' | 'center' = 'left') => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color);
    pdf.text(clean(value), x, y, { align });
  };
  const centeredLines = (value: string, x: number, y: number, width: number, height: number, size: number, color: [number, number, number], bold = false, maxLines = 3) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size);
    let lines = pdf.splitTextToSize(clean(value), width - 10) as string[];
    while (lines.length > maxLines && size > 5.5) {
      size -= .25; pdf.setFontSize(size);
      lines = pdf.splitTextToSize(clean(value), width - 10) as string[];
    }
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last && pdf.getTextWidth(`${last}...`) > width - 10) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}...`;
    }
    const leading = size * 1.1;
    lines.forEach((line, i) => text(line, x + width / 2, y + height / 2 - (lines.length - 1) * leading / 2 + size * .35 + i * leading, size, color, bold, 'center'));
  };
  pdf.setFillColor(237, 242, 247); pdf.rect(36, top, 540, headerHeight, 'F');
  [3, 5].forEach((column) => {
    pdf.setFillColor(253, 248, 234);
    pdf.rect(COLUMNS[column], top, COLUMNS[column + 1] - COLUMNS[column], bottom - top, 'F');
  });
  centeredLines('SECTION', 36, top, 78, headerHeight, 6.4, NAVY, true);
  centeredLines('METRIC', 114, top, 170, headerHeight, 6.4, NAVY, true);
  sides.forEach((side, index) => {
    const companyColumn = 2 + index * 2, firmColumn = companyColumn + 1;
    centeredLines(side.portfolio.companyName, COLUMNS[companyColumn], top, 82, headerHeight, 7.3, COMPARISON_COLORS[index], true);
    centeredLines('ZILKA-KOTAB\nBENCHMARK', COLUMNS[firmColumn], top, 64, headerHeight, 6.1, GOLD, true);
  });
  rows.forEach((row, index) => {
    const y = bodyTop + index * rowHeight;
    if (index % 2 === 0) {
      pdf.setFillColor(247, 249, 251); pdf.rect(114, y, 170, rowHeight, 'F');
      [2, 4].forEach((column) => pdf.rect(COLUMNS[column], y, 82, rowHeight, 'F'));
    }
    text(row.label, 120, y + 11.5, 7.2);
    row.cells.forEach((cell, index) => {
      const companyColumn = 2 + index * 2, firmColumn = companyColumn + 1;
      text(cell.value, COLUMNS[companyColumn] + 41, y + 11.7, 8.5, COMPARISON_COLORS[index], true, 'center');
      if (cell.benchmark) {
        pdf.setDrawColor(...GOLD); pdf.setLineWidth(.45);
        pdf.roundedRect(COLUMNS[firmColumn] + 5, y + 3, 54, 12, 2, 2, 'S');
      }
      // Keep units: counts and years must not be relabeled as percentages.
      text(cell.benchmark ? firmValue(cell.benchmark) : '-', COLUMNS[firmColumn] + 32, y + 11.7, 8, GOLD, !!cell.benchmark, 'center');
    });
  });
  [
    { label: 'PORTFOLIO\nAT A GLANCE', start: 0, count: 3 },
    { label: 'PROSECUTION\nEFFICIENCY', start: 3, count: 6 },
  ].forEach((section) => {
    const y = bodyTop + section.start * rowHeight, height = section.count * rowHeight;
    pdf.setFillColor(235, 241, 247); pdf.rect(36, y, 78, height, 'F');
    centeredLines(section.label, 36, y, 78, height, 8.2, NAVY, true);
  });
  pdf.setDrawColor(...GRID); pdf.setLineWidth(.4);
  COLUMNS.forEach((x) => pdf.line(x, top, x, bottom));
  pdf.line(36, top, 576, top);
  for (let index = 0; index <= rows.length; index++) {
    const y = bodyTop + index * rowHeight;
    pdf.line(index === 0 || index === 3 || index === rows.length ? 36 : 114, y, 576, y);
  }
  return bottom;
}
