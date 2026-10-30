// Browser-side file readers for fee schedules. Only normalized rows leave this module.
import { MAX_FILE_BYTES, MAX_XML_BYTES, gridsToEntries, parseCsv, type Grid, type FeeDraftEntry } from './fee-schedule-parse';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Extract w:tbl grids (top-level rows only) from word/document.xml using DOMParser. */
export function docxXmlToGrids(xml: string): Grid[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The Word document is corrupt or unreadable.');
  const grids: Grid[] = [];
  const tables = Array.from(doc.getElementsByTagNameNS(W, 'tbl'));
  for (const tbl of tables) {
    const rows = Array.from(tbl.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tr' && (n as Element).namespaceURI === W);
    grids.push(rows.map((tr) => Array.from(tr.childNodes)
      .filter((n): n is Element => n.nodeType === 1 && (n as Element).localName === 'tc')
      .map((tc) => Array.from(tc.getElementsByTagNameNS(W, 'p')).map((p) => Array.from(p.getElementsByTagNameNS(W, 't')).map((t) => t.textContent ?? '').join('')).join(' '))));
  }
  return grids;
}

async function readDocx(file: File): Promise<Grid[]> {
  const JSZip = (await import('jszip')).default;
  let zip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); } catch { throw new Error('The .docx file is corrupt or not a Word document.'); }
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('The .docx file has no document body.');
  // Non-public JSZip field; checked before inflating to a string when available.
  const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
  if (typeof size === 'number' && size > MAX_XML_BYTES) throw new Error('The Word document is too large once decompressed.');
  const xml = await entry.async('string');
  if (xml.length > MAX_XML_BYTES) throw new Error('The Word document is too large once decompressed.');
  return docxXmlToGrids(xml);
}

async function readXlsx(file: File): Promise<Grid[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(await file.arrayBuffer()); } catch { throw new Error('The .xlsx file is corrupt or unreadable.'); }
  return wb.worksheets.map((ws) => {
    const grid: Grid = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (c, col) => { cells[col - 1] = c.text ?? ''; });
      grid.push(Array.from(cells, (v) => v ?? ''));
    });
    return grid;
  });
}

export async function readFeeScheduleFile(file: File): Promise<{ entries: FeeDraftEntry[]; warnings: string[] }> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Files must be 5 MB or smaller.');
  const name = file.name.toLowerCase();
  let grids: Grid[];
  if (name.endsWith('.docx')) grids = await readDocx(file);
  else if (name.endsWith('.xlsx')) grids = await readXlsx(file);
  else if (name.endsWith('.csv')) grids = [parseCsv(await file.text())];
  else throw new Error('Unsupported file type. Upload .docx, .xlsx or .csv.');
  return gridsToEntries(grids);
}
