// Pure fee-schedule parsing helpers. No DOM, no I/O, safe for node tests.
import type { FirmFeeEntry, FirmFeeEntryRateType } from '@workspace/api-client-react';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 1000;
export const MAX_XML_BYTES = 40 * 1024 * 1024;

export type Grid = string[][];
export type FeeDraftEntry = FirmFeeEntry;

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const key = (s: string) => norm(s).toLowerCase().replace(/[^a-z]/g, '');

type Field = 'code' | 'jurisdiction' | 'subjectMatter' | 'itemShort' | 'description' | 'rate';
const ALIASES: Record<Field, string[]> = {
  code: ['billingcode', 'code', 'feecode', 'taskcode'],
  jurisdiction: ['jurisdiction', 'country', 'office'],
  subjectMatter: ['subjectmatter', 'subject', 'matter type', 'mattertype'],
  itemShort: ['item', 'itemshort', 'service', 'task'],
  description: ['itemdetails', 'details', 'description', 'itemdescription'],
  rate: ['attorneyflatratefee', 'flatratefee', 'flatfee', 'fee', 'rate', 'amount', 'attorneyfee', 'price'],
};

/** Map header cells to fields. Returns null if not a fee-schedule header. Throws on ambiguity. */
export function detectHeader(cells: string[]): Record<Field, number> | null {
  const found: Partial<Record<Field, number>> = {};
  cells.forEach((c, i) => {
    const k = key(c);
    if (!k) return;
    for (const f of Object.keys(ALIASES) as Field[]) {
      if (ALIASES[f].some((a) => a.replace(/[^a-z]/g, '') === k)) {
        if (found[f] !== undefined) throw new Error(`Ambiguous table: more than one "${f}" column ("${norm(c)}").`);
        found[f] = i;
        return;
      }
    }
  });
  if (found.code === undefined || found.itemShort === undefined || found.rate === undefined) return null;
  return { code: found.code, itemShort: found.itemShort, rate: found.rate, jurisdiction: found.jurisdiction ?? -1, subjectMatter: found.subjectMatter ?? -1, description: found.description ?? -1 };
}

/** Classify the source rate text. Hourly rates are never treated as a whole fee. */
export function classifyRate(text: string): { rateType: FirmFeeEntryRateType; amountCents: number | null } {
  const t = norm(text);
  const lower = t.toLowerCase();
  if (/\/\s*h(ou)?r|per\s+hour|hourly/.test(lower)) return { rateType: 'HOURLY', amountCents: null };
  if (/approv/.test(lower)) return { rateType: 'APPROVAL', amountCents: null };
  if (/figure|adjust|credit|\(\s*\$/.test(lower)) return { rateType: 'ADJUSTMENT', amountCents: null };
  const m = /^\$?\s*([\d,]+(?:\.\d{1,2})?)\s*$/.exec(t.replace(/USD/i, '').trim());
  if (m) {
    const [w, f = ''] = m[1].replace(/,/g, '').split('.');
    return { rateType: 'FLAT', amountCents: Number(w) * 100 + Number((f + '00').slice(0, 2)) };
  }
  return { rateType: 'APPROVAL', amountCents: null };
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

/**
 * Find exactly one fee-schedule table among grids and convert rows to entries.
 * Non-matching tables (signature blocks, agreement prose) are skipped.
 */
export function gridsToEntries(grids: Grid[]): { entries: FeeDraftEntry[]; warnings: string[] } {
  const matches: { grid: Grid; headerRow: number; map: Record<Field, number> }[] = [];
  for (const grid of grids) {
    for (let r = 0; r < Math.min(grid.length, 5); r++) {
      const map = detectHeader(grid[r]);
      if (map) { matches.push({ grid, headerRow: r, map }); break; }
    }
  }
  if (matches.length === 0) throw new Error('No fee schedule table found. Expected columns such as Billing Code, Item and Attorney Flat Rate Fee.');
  if (matches.length > 1) throw new Error(`Found ${matches.length} tables that look like fee schedules. Upload a file with a single schedule table.`);
  const { grid, headerRow, map } = matches[0];
  const entries: FeeDraftEntry[] = [];
  const warnings: string[] = [];
  const cell = (row: string[], i: number) => (i < 0 ? '' : norm(row[i] ?? ''));
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    const code = cell(row, map.code);
    const itemShort = cell(row, map.itemShort);
    const rateText = cell(row, map.rate);
    if (!code && !itemShort && !rateText) continue;
    if (!code || !itemShort) { warnings.push(`Row ${r + 1} skipped: missing billing code or item.`); continue; }
    const { rateType, amountCents } = classifyRate(rateText);
    entries.push({
      id: `e${entries.length + 1}`,
      code: clip(code, 100), jurisdiction: clip(cell(row, map.jurisdiction), 100), subjectMatter: clip(cell(row, map.subjectMatter), 1000),
      itemShort: clip(itemShort, 2000), description: clip(cell(row, map.description), 10000), rateType, rateText: clip(rateText, 500), amountCents,
    });
    if (entries.length > MAX_ROWS) throw new Error(`The schedule has more than ${MAX_ROWS} rows.`);
  }
  if (entries.length === 0) throw new Error('The fee schedule table has no usable rows.');
  warnings.push(...duplicateWarnings(entries));
  return { entries, warnings };
}

export function duplicateWarnings(entries: FeeDraftEntry[]): string[] {
  const counts = new Map<string, number>();
  entries.forEach((e) => counts.set(e.code, (counts.get(e.code) ?? 0) + 1));
  return [...counts].filter(([, n]) => n > 1).map(([c, n]) => `Code ${c} appears ${n} times. Each row is kept as a separate entry; check the descriptions.`);
}

/** RFC 4180 style CSV parser with quoted fields, escaped quotes and CRLF. */
export function parseCsv(text: string): Grid {
  const rows: Grid = [];
  let row: string[] = []; let field = ''; let q = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') {
      if (field.trim() !== '') throw new Error(`Malformed CSV: unexpected quote on line ${rows.length + 1}.`);
      q = true; field = '';
    } else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
      if (rows.length > MAX_ROWS + 5) throw new Error(`The file has more than ${MAX_ROWS} rows.`);
    } else field += ch;
  }
  if (q) throw new Error('Malformed CSV: a quoted field is not closed.');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Normalize entries before POST: trim, renumber ids, validate required fields. */
export function finalizeEntries(entries: FeeDraftEntry[]): FeeDraftEntry[] | string {
  if (entries.length === 0) return 'Add at least one fee entry.';
  if (entries.length > MAX_ROWS) return `A schedule can have at most ${MAX_ROWS} entries.`;
  const out: FeeDraftEntry[] = [];
  for (const [i, e] of entries.entries()) {
    const code = norm(e.code); const itemShort = norm(e.itemShort);
    if (!code || !itemShort) return `Row ${i + 1}: code and item are required.`;
    if (e.rateType === 'FLAT' && (e.amountCents == null || e.amountCents < 0)) return `Row ${i + 1}: flat fees need an amount.`;
    out.push({ ...e, id: e.id || `e${i + 1}`, code, itemShort, jurisdiction: norm(e.jurisdiction), subjectMatter: norm(e.subjectMatter), description: e.description.trim(), rateText: norm(e.rateText), amountCents: e.rateType === 'FLAT' ? e.amountCents : null });
  }
  const ids = new Set(out.map((e) => e.id));
  if (ids.size !== out.length) return 'Entry IDs must be unique.';
  return out;
}

export const sameClient = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
