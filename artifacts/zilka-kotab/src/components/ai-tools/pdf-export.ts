import { jsPDF } from 'jspdf';

export type PdfMetric = { label: string; value: string; detail?: string };
export type PdfSection =
  | { type: 'metrics'; title: string; items: PdfMetric[]; note?: string }
  | { type: 'text'; title: string; paragraphs: string[] }
  | { type: 'table'; title: string; columns: string[]; rows: string[][]; note?: string }
  | { type: 'bars'; title: string; items: { label: string; value: number; display?: string }[]; note?: string };

export type PdfReport = {
  filename: string;
  title: string;
  subtitle: string;
  retrievedAt: string;
  sections: PdfSection[];
};

export async function createPdfReportBlob(report: PdfReport): Promise<Blob> {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 46;
  const right = 46;
  const width = pageWidth - left - right;
  const bottom = pageHeight - 58;
  let y = 56;

  const text = (value: string) => value
    .replace(/[≤]/g, '<=')
    .replace(/[–—]/g, '-')
    .replace(/[·•]/g, '|')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const newPage = () => {
    pdf.addPage();
    y = 58;
  };
  const ensure = (height: number) => {
    if (y + height > bottom) newPage();
  };
  const sectionTitle = (title: string) => {
    ensure(40);
    y += 8;
    pdf.setFillColor(32, 58, 91);
    pdf.rect(left, y, 4, 20, 'F');
    pdf.setTextColor(32, 58, 91);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(text(title), left + 12, y + 14);
    y += 30;
  };
  const paragraph = (value: string) => {
    const lines = pdf.splitTextToSize(text(value), width);
    const height = lines.length * 12 + 8;
    ensure(height);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(92, 101, 114);
    pdf.text(lines, left, y);
    y += height;
  };

  pdf.setFillColor(32, 58, 91);
  pdf.rect(0, 0, pageWidth, 8, 'F');
  pdf.setTextColor(165, 133, 70);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('ZILKA-KOTAB PC  /  PUBLIC PATENT INTELLIGENCE', left, y);
  y += 25;
  pdf.setTextColor(31, 42, 57);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  const titleLines = pdf.splitTextToSize(text(report.title), width);
  pdf.text(titleLines, left, y);
  y += titleLines.length * 25 + 2;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(92, 101, 114);
  const subtitleLines = pdf.splitTextToSize(text(report.subtitle), width);
  pdf.text(subtitleLines, left, y);
  y += subtitleLines.length * 14 + 8;
  pdf.setFontSize(8);
  pdf.text(`Retrieved ${text(report.retrievedAt)}  ·  Source: USPTO Open Data Portal`, left, y);
  y += 18;
  pdf.setDrawColor(216, 220, 226);
  pdf.line(left, y, pageWidth - right, y);
  y += 15;

  for (const section of report.sections) {
    sectionTitle(section.title);
    if (section.type === 'text') {
      for (const item of section.paragraphs) paragraph(item);
      continue;
    }
    if (section.type === 'metrics') {
      const columns = section.items.length > 2 ? 2 : 1;
      const gap = 10;
      const cardWidth = (width - gap * (columns - 1)) / columns;
      const rows = Math.ceil(section.items.length / columns);
      const cardHeight = 68;
      ensure(rows * (cardHeight + gap) + 18);
      section.items.forEach((item, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        const x = left + col * (cardWidth + gap);
        const top = y + row * (cardHeight + gap);
        pdf.setFillColor(247, 248, 250);
        pdf.setDrawColor(222, 226, 231);
        pdf.roundedRect(x, top, cardWidth, cardHeight, 3, 3, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(101, 111, 124);
        pdf.text(pdf.splitTextToSize(text(item.label).toUpperCase(), cardWidth - 18), x + 9, top + 15);
        pdf.setFontSize(15);
        pdf.setTextColor(32, 58, 91);
        pdf.text(pdf.splitTextToSize(text(item.value), cardWidth - 18), x + 9, top + 36);
        if (item.detail) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.setTextColor(92, 101, 114);
          pdf.text(pdf.splitTextToSize(text(item.detail), cardWidth - 18).slice(0, 2), x + 9, top + 51);
        }
      });
      y += rows * (cardHeight + gap);
      if (section.note) paragraph(section.note);
      y += 5;
      continue;
    }
    if (section.type === 'bars') {
      const max = Math.max(1, ...section.items.map((item) => item.value));
      for (const item of section.items) {
        ensure(30);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(54, 63, 76);
        pdf.text(pdf.splitTextToSize(text(item.label), 160).slice(0, 1), left, y + 9);
        const barX = left + 165;
        const barWidth = width - 215;
        pdf.setFillColor(229, 232, 237);
        pdf.roundedRect(barX, y, barWidth, 10, 2, 2, 'F');
        pdf.setFillColor(32, 58, 91);
        pdf.roundedRect(barX, y, Math.max(2, (item.value / max) * barWidth), 10, 2, 2, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.text(text(item.display ?? String(item.value)), pageWidth - right, y + 9, { align: 'right' });
        y += 23;
      }
      if (section.note) paragraph(section.note);
      continue;
    }
    const colCount = section.columns.length;
    const colWidth = width / colCount;
    const drawHeader = () => {
      pdf.setFillColor(32, 58, 91);
      pdf.rect(left, y, width, 24, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255);
      section.columns.forEach((column, index) => {
        pdf.text(pdf.splitTextToSize(text(column), colWidth - 12).slice(0, 2), left + index * colWidth + 6, y + 10);
      });
      y += 24;
    };
    drawHeader();
    section.rows.forEach((row, rowIndex) => {
      const cellLines = section.columns.map((_, index) => pdf.splitTextToSize(text(row[index] ?? '—'), colWidth - 12));
      const rowHeight = Math.max(24, ...cellLines.map((lines) => lines.length * 10 + 12));
      if (y + rowHeight > bottom) {
        newPage();
        sectionTitle(section.title);
        drawHeader();
      }
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(247, 248, 250);
        pdf.rect(left, y, width, rowHeight, 'F');
      }
      pdf.setDrawColor(224, 228, 233);
      pdf.line(left, y + rowHeight, left + width, y + rowHeight);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(54, 63, 76);
      cellLines.forEach((lines, index) => {
        pdf.text(lines, left + index * colWidth + 6, y + 12);
      });
      y += rowHeight;
    });
    if (section.note) paragraph(section.note);
    y += 8;
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(218, 222, 228);
    pdf.line(left, pageHeight - 42, pageWidth - right, pageHeight - 42);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(115, 123, 134);
    pdf.text('Public USPTO records · Informational only; not a legal opinion', left, pageHeight - 27);
    pdf.text(`${page} / ${pages}`, pageWidth - right, pageHeight - 27, { align: 'right' });
  }
  return pdf.output('blob');
}

export async function downloadPdfReport(report: PdfReport) {
  const blob = await createPdfReportBlob(report);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.filename.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'patent-report'}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
