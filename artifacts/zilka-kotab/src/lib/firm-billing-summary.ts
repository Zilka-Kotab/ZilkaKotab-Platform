// Pure helpers for flat-fee billing summaries and workbook rows. No React, no I/O.
import type { FirmBillingItem } from './hooks-firm-operations';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const QUARTERS = [
  { label: 'Q1 (through Mar)', months: [0, 1, 2] },
  { label: 'Q2 (through Jun)', months: [3, 4, 5] },
  { label: 'Q3 (through Sep)', months: [6, 7, 8] },
  { label: 'Q4 (through Dec)', months: [9, 10, 11] },
] as const;

export type BillingKind = 'FEE' | 'EXPENSE' | 'REIMBURSEMENT';

export interface SummaryTotals {
  /** Billables by workDate */
  feeGrossCents: number;
  feeNetCents: number;
  expenseCents: number;
  reimbursementCents: number;
  /** Fee + expense items by invoiceDate */
  invoicedCents: number;
  /** Payments on fee + expense items by payment receivedOn */
  receivedCents: number;
  /** Payments on reimbursement items by payment receivedOn */
  reimbursementReceivedCents: number;
}

export const emptyTotals = (): SummaryTotals => ({ feeGrossCents: 0, feeNetCents: 0, expenseCents: 0, reimbursementCents: 0, invoicedCents: 0, receivedCents: 0, reimbursementReceivedCents: 0 });

export function addTotals(a: SummaryTotals, b: SummaryTotals): SummaryTotals {
  const out = emptyTotals();
  (Object.keys(out) as (keyof SummaryTotals)[]).forEach((k) => { out[k] = a[k] + b[k]; });
  return out;
}

/** Parse a USD dollar string to integer cents. Returns null if invalid. */
export function dollarsToCents(input: string): number | null {
  const clean = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}
export const centsToDollarInput = (cents: number) => (cents / 100).toFixed(2);
export const formatUsd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** Net share for a fee: amount * shareBasisPoints / 10000, rounded to the cent. */
export function netCents(item: Pick<FirmBillingItem, 'kind' | 'amountCents' | 'shareBasisPoints'>): number {
  return item.kind === 'FEE' ? Math.round((item.amountCents * item.shareBasisPoints) / 10000) : 0;
}
export const balanceCents = (item: Pick<FirmBillingItem, 'amountCents' | 'paidCents'>) => Math.max(0, item.amountCents - item.paidCents);
export const isLocked = (item: Pick<FirmBillingItem, 'paidCents' | 'invoiceNumber' | 'invoiceDate'>) => item.paidCents > 0 || !!item.invoiceNumber || !!item.invoiceDate;

const ym = (date: string | null | undefined): [number, number] | null => {
  if (!date) return null;
  const m = /^(\d{4})-(\d{2})/.exec(date);
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? [Number(m[1]), Number(m[2]) - 1] : null;
};

/** Include every source row that contributes billables, an invoice or a receipt to this year. */
export function itemsForYear(items: FirmBillingItem[], year: number): FirmBillingItem[] {
  return items.filter((i) => [i.workDate, i.invoiceDate, i.completedOn, ...i.payments.map((p) => p.receivedOn)]
    .some((date) => ym(date)?.[0] === year));
}

/** Month-by-month totals for a year. Voided items are excluded. */
export function monthlyTotals(items: FirmBillingItem[], year: number): SummaryTotals[] {
  const months = MONTHS.map(() => emptyTotals());
  for (const item of items) {
    if (item.voided) continue;
    const w = ym(item.workDate);
    if (w && w[0] === year) {
      const t = months[w[1]];
      if (item.kind === 'FEE') { t.feeGrossCents += item.amountCents; t.feeNetCents += netCents(item); }
      else if (item.kind === 'EXPENSE') t.expenseCents += item.amountCents;
      else t.reimbursementCents += item.amountCents;
    }
    const inv = ym(item.invoiceDate);
    if (inv && inv[0] === year && item.kind !== 'REIMBURSEMENT') months[inv[1]].invoicedCents += item.amountCents;
    for (const p of item.payments) {
      const r = ym(p.receivedOn);
      if (!r || r[0] !== year) continue;
      if (item.kind === 'REIMBURSEMENT') months[r[1]].reimbursementReceivedCents += p.amountCents;
      else months[r[1]].receivedCents += p.amountCents;
    }
  }
  return months;
}

export function quarterTotals(monthly: SummaryTotals[]): SummaryTotals[] {
  return QUARTERS.map((q) => q.months.reduce((acc, m) => addTotals(acc, monthly[m]), emptyTotals()));
}
export const yearTotals = (monthly: SummaryTotals[]) => monthly.reduce(addTotals, emptyTotals());

/** Item filter by workDate year/month (month 0-11, or null for all). */
export function filterByPeriod(items: FirmBillingItem[], year: number | null, month: number | null): FirmBillingItem[] {
  return items.filter((item) => {
    const w = ym(item.workDate);
    if (!w) return year === null;
    return (year === null || w[0] === year) && (month === null || w[1] === month);
  });
}

export function yearsIn(items: FirmBillingItem[]): number[] {
  const set = new Set<number>([new Date().getFullYear()]);
  for (const i of items) {
    const w = ym(i.workDate); if (w) set.add(w[0]);
    const v = ym(i.invoiceDate); if (v) set.add(v[0]);
    const c = ym(i.completedOn); if (c) set.add(c[0]);
    i.payments.forEach((p) => { const r = ym(p.receivedOn); if (r) set.add(r[0]); });
  }
  return [...set].sort((a, b) => b - a);
}

export const RAW_HEADERS = ['FILED/COMPLETED', 'CLIENT', 'MATTER', 'FEES', 'CODE', 'JURISDICTION', 'SUBJECT MATTER', 'ITEM', 'ITEM DETAILS', 'NOTES', 'GROSS', '%', 'ASSOCIATE', 'NET', 'INVOICE NUMBER', 'INVOICE DATE', 'PAID', 'BALANCE', 'LAST PAYMENT DATE', 'PAYMENT REFERENCES', 'VOIDED', 'PRE-BILLED', 'PRE-BILL DATE', 'ACTUAL COMPLETION DATE', 'BILLING WORK DATE'] as const;

export type RawCell = string | number;
/** Raw billing rows mirroring the uploaded template. Money in dollars (numbers), text as strings. */
export function rawRows(items: FirmBillingItem[]): RawCell[][] {
  return [...items].sort((a, b) => a.workDate.localeCompare(b.workDate)).map((i) => {
    const last = [...i.payments].sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))[0];
    return [
      i.workflowPublicId ? i.completedOn ?? '' : i.workDate, i.client, i.matter, i.kind, i.code, i.jurisdiction, i.subjectMatter, (i.kind === 'FEE' ? 'Flat fee' : i.kind === 'EXPENSE' ? 'Expense' : 'Reimbursement to firm') + (i.prebilledOn ? '*' : ''), i.description, i.notes,
      i.amountCents / 100, i.shareBasisPoints / 10000, i.associate, netCents(i) / 100,
      i.invoiceNumber, i.invoiceDate ?? '', i.paidCents / 100, balanceCents(i) / 100, last?.receivedOn ?? '',
      i.payments.map((p) => p.reference).filter(Boolean).join('; '), i.voided ? 'YES' : '',
      i.prebilledOn ? 'YES*' : '', i.prebilledOn ?? '', i.completedOn ?? '', i.workDate,
    ];
  });
}

export const SUMMARY_HEADERS = ['PERIOD', 'FEES GROSS (work date)', 'FEES NET (work date)', 'EXPENSES (work date)', 'REIMBURSEMENTS (work date)', 'INVOICED (invoice date)', 'RECEIVED fees+expenses (payment date)', 'REIMBURSEMENTS RECEIVED (payment date)'] as const;
const toRow = (label: string, t: SummaryTotals): RawCell[] => [label, t.feeGrossCents / 100, t.feeNetCents / 100, t.expenseCents / 100, t.reimbursementCents / 100, t.invoicedCents / 100, t.receivedCents / 100, t.reimbursementReceivedCents / 100];

/** Monthly summary rows with a quarter subtotal after Mar/Jun/Sep/Dec and a year total. */
export function summaryRows(items: FirmBillingItem[], year: number): RawCell[][] {
  const monthly = monthlyTotals(items, year);
  const quarters = quarterTotals(monthly);
  const rows: RawCell[][] = [];
  QUARTERS.forEach((q, qi) => {
    q.months.forEach((m) => rows.push(toRow(`${MONTHS[m]} ${year}`, monthly[m])));
    rows.push(toRow(`${q.label.split(' ')[0]} ${year} total`, quarters[qi]));
  });
  rows.push(toRow(`${year} total`, yearTotals(monthly)));
  return rows;
}
