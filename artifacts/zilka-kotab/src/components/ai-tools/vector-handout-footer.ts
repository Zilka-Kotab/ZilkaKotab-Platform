import type { jsPDF } from 'jspdf';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import footerPdfUrl from '../../assets/firm-handout-footer.pdf?inline';

const PORTFOLIO_PDF_QUESTIONS = [
  'If AI freed attorney capacity, where would those hours create the most value?',
  'Do you have a strategy for how AI tools should fit together across the patent lifecycle—or are individual tools being adopted independently?',
  'How do you know your patent spend is producing the right patents—not simply more patents?',
  'How often do you test your existing claims against your competitors’ actual products and technology direction?',
  'When you identify a strategically important patent family, what do you do differently with it?',
] as const;

/** Compose a native-text/vector footer from the supplied handout, without rasterizing it.
 * The portrait and original QR code remain embedded images at their source resolution.
 */
export async function finishSnapshotWithVectorFooter(
  report: jsPDF,
  examinerQuestions?: readonly string[],
): Promise<Blob> {
  const response = await fetch(footerPdfUrl);
  if (!response.ok) throw new Error('The firm handout footer could not be loaded.');

  const output = await PDFDocument.create();
  const reportPage = await output.embedPdf(report.output('arraybuffer'));
  const footerPage = await output.embedPdf(await response.arrayBuffer());
  const page = output.addPage([612, 792]);
  page.drawPage(reportPage[0], { x: 0, y: 0, width: 612, height: 792 });
  page.drawPage(footerPage[0], { x: 0, y: 0, width: 612, height: 362.5 });

  // The question marks, circles, heading and rule are vector artwork in the
  // footer. Only question text is supplied here so both snapshots remain crisp.
  const font = await output.embedFont(StandardFonts.Helvetica);
  const questions = examinerQuestions ?? PORTFOLIO_PDF_QUESTIONS;
  for (const [index, original] of questions.entries()) {
    const text = original.replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    let size = 7.5;
    while (font.widthOfTextAtSize(text, size) > 520 && size > 6.5) size -= 0.1;
    if (font.widthOfTextAtSize(text, size) > 520) {
      throw new Error('A handout question is too long to fit on one line.');
    }
    page.drawText(text, { x: 56.25, y: 792 - (469.5 + index * 16.5), size, font, color: rgb(0.04, 0.12, 0.2) });
  }
  const bytes = await output.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
