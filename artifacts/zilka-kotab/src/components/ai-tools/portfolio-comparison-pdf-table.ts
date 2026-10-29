import type { jsPDF } from 'jspdf';
import { comparisonCompanyLabel, comparisonReportRows, comparisonWinner, firmValue, type ComparisonReportSide, type ComparisonRow } from './portfolio-comparison-report-data';
import { COMPARISON_COLORS } from './portfolio-comparison-pdf-charts';

const NAVY: [number, number, number] = [11, 31, 53];
const GOLD: [number, number, number] = [157, 119, 16];
const GRID: [number, number, number] = [213, 220, 227];
const clean = (s: string) => s.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
type TableColumn = { kind: 'section' | 'metric' | 'company' | 'benchmark'; x: number; width: number; side: number };

export function comparisonTableColumns(rows: ComparisonRow[]): TableColumn[] {
  const firmColumns = [0, 1].map((side) => rows.some((row) => !!row.cells[side]?.benchmark));
  const companyWidth = (292 - firmColumns.filter(Boolean).length * 64) / 2;
  const columns: TableColumn[] = [
    { kind: 'section', x: 36, width: 78, side: -1 },
    { kind: 'metric', x: 114, width: 170, side: -1 },
  ];
  let x = 284;
  for (let side = 0; side < 2; side++) {
    columns.push({ kind: 'company', x, width: companyWidth, side });
    x += companyWidth;
    if (firmColumns[side]) {
      columns.push({ kind: 'benchmark', x, width: 64, side });
      x += 64;
    }
  }
  return columns;
}

/** Four to six columns; each optional benchmark column needs its own qualifying advantage. */
export function drawComparisonTable(pdf: jsPDF, sides: readonly ComparisonReportSide[]) {
  const top = 94, headerHeight = 30, rowHeight = 18, bodyTop = top + headerHeight;
  const rows = comparisonReportRows(sides);
  const columns = comparisonTableColumns(rows);
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
  centeredLines('SECTION', 36, top, 78, headerHeight, 6.4, NAVY, true);
  centeredLines('METRIC', 114, top, 170, headerHeight, 6.4, NAVY, true);
  columns.filter((column) => column.side >= 0).forEach((column) => {
    centeredLines(column.kind === 'company' ? comparisonCompanyLabel(sides[column.side].portfolio.companyName) : 'ZILKA-KOTAB\nBENCHMARK',
      column.x, top, column.width, headerHeight, column.kind === 'company' ? 7.3 : 6.1,
      column.kind === 'company' ? COMPARISON_COLORS[column.side] : GOLD, true);
  });
  rows.forEach((row, index) => {
    const y = bodyTop + index * rowHeight;
    if (index % 2 === 0) {
      pdf.setFillColor(247, 249, 251); pdf.rect(114, y, 462, rowHeight, 'F');
    }
    text(row.label, 120, y + 11.5, 7.2);
    const winner = comparisonWinner(row);
    columns.filter((column) => column.side >= 0).forEach((column) => {
      const cell = row.cells[column.side];
      const center = column.x + column.width / 2;
      if (column.kind === 'company') {
        if (winner === column.side) {
          const tint: [number, number, number] = column.side === 0 ? [231, 239, 248] : [249, 233, 238];
          pdf.setFillColor(...tint);
          pdf.setDrawColor(...COMPARISON_COLORS[column.side]); pdf.setLineWidth(.6);
          pdf.roundedRect(column.x + 3, y + 2, column.width - 6, 14, 2, 2, 'FD');
        }
        text(cell.value, center, y + 11.7, 8.5, COMPARISON_COLORS[column.side], true, 'center');
      } else {
        if (cell.benchmark) {
          pdf.setDrawColor(...GOLD); pdf.setLineWidth(.45);
          pdf.roundedRect(column.x + 5, y + 3, column.width - 10, 12, 2, 2, 'S');
        }
        // Keep units: counts and years must not be relabeled as percentages.
        text(cell.benchmark ? firmValue(cell.benchmark) : '-', center, y + 11.7, 8, GOLD, !!cell.benchmark, 'center');
      }
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
  [...columns.map((column) => column.x), 576].forEach((x) => pdf.line(x, top, x, bottom));
  pdf.line(36, top, 576, top);
  for (let index = 0; index <= rows.length; index++) {
    const y = bodyTop + index * rowHeight;
    pdf.line(index === 0 || index === 3 || index === rows.length ? 36 : 114, y, 576, y);
  }
  return bottom;
}
