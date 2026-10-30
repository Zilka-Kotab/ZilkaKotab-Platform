import { FormEvent, Fragment, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, Plus, RefreshCw, X } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { DashboardTabs } from '@/components/portal/DashboardTabs';
import { StaffOnly, errorText, fieldClass } from '@/components/portal/StaffOnly';
import InternalWorkflowOperations from './InternalWorkflowOperations';
import { useCreateFirmBilling, useFirmBilling, useRecordFirmPayment, useUpdateFirmBilling } from '@/lib/hooks-firm-operations';
import type { FirmBillingInput, FirmBillingItem } from '@/lib/hooks-firm-operations';
import {
  MONTHS, QUARTERS, RAW_HEADERS, SUMMARY_HEADERS, balanceCents, centsToDollarInput, dollarsToCents, filterByPeriod, formatUsd,
  isLocked, itemsForYear, monthlyTotals, netCents, quarterTotals, rawRows, summaryRows, yearTotals, yearsIn, type BillingKind, type SummaryTotals,
} from '@/lib/firm-billing-summary';

const KIND_LABEL: Record<BillingKind, string> = { FEE: 'Flat fee', EXPENSE: 'Expense', REIMBURSEMENT: 'Reimbursement to firm' };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function FirmBilling() {
  return <StaffOnly><DashboardTabs /><BillingLedger /></StaffOnly>;
}

function BillingLedger() {
  const ledger = useFirmBilling();
  const items = useMemo(() => ledger.data?.items ?? [], [ledger.data]);
  const years = useMemo(() => yearsIn(items), [items]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [kind, setKind] = useState<'' | BillingKind>('');
  const [showVoided, setShowVoided] = useState(false);
  const [editing, setEditing] = useState<FirmBillingItem | 'new' | null>(null);
  const [paying, setPaying] = useState<FirmBillingItem | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const monthly = useMemo(() => monthlyTotals(items, year), [items, year]);
  const quarters = useMemo(() => quarterTotals(monthly), [monthly]);
  const period: SummaryTotals = month === null ? yearTotals(monthly) : monthly[month];
  const visible = useMemo(() => filterByPeriod(items, year, month)
    .filter((i) => (kind ? i.kind === kind : true) && (showVoided || !i.voided))
    .sort((a, b) => b.workDate.localeCompare(a.workDate)), [items, year, month, kind, showVoided]);

  const exportWorkbook = async () => {
    setExportError(null);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Zilka-Kotab Firm Portal';
      const raw = wb.addWorksheet('Raw billing');
      raw.addRow([...RAW_HEADERS]).font = { bold: true };
      // Plain string/number values only: ExcelJS writes strings as text, never as formulas.
      rawRows(itemsForYear(items, year)).forEach((r) => raw.addRow(r));
      [11, 14, 17, 18].forEach((c) => { raw.getColumn(c).numFmt = '$#,##0.00'; });
      raw.getColumn(12).numFmt = '0.00%';
      raw.columns.forEach((c) => { c.width = 16; });
      const sum = wb.addWorksheet('Monthly summary');
      sum.addRow([`Zilka-Kotab billing summary ${year}. Billables by work date; invoiced by invoice date; received by payment date. * Pre-billed before completion; completion does not count the charge twice. Voided items excluded.`]);
      sum.addRow([...SUMMARY_HEADERS]).font = { bold: true };
      summaryRows(items, year).forEach((r) => { const row = sum.addRow(r); if (String(r[0]).includes('total')) row.font = { bold: true }; });
      for (let c = 2; c <= 8; c++) sum.getColumn(c).numFmt = '$#,##0.00';
      sum.columns.forEach((c) => { c.width = 22; });
      const buffer = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a'); a.href = url; a.download = `zilka-kotab-billing-${year}.xlsx`; a.click(); URL.revokeObjectURL(url);
    } catch (reason) { setExportError(errorText(reason, 'The workbook could not be created.')); }
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-9">
      <SEO title="Time & Billing" description="Zilka-Kotab flat-fee ledger" url="/portal/billing" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="portal-eyebrow text-[10px] font-bold uppercase">Time &amp; Billing</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Flat-fee ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pre-bill active work or let filed work arrive automatically. Billing, completion, invoicing and payment remain separate.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void ledger.refetch()} data-testid="button-refresh-billing" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"><RefreshCw className={`h-4 w-4 ${ledger.isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
          <button onClick={() => void exportWorkbook()} disabled={ledger.isLoading} data-testid="button-export-workbook" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"><Download className="h-4 w-4" /> Export {year} workbook</button>
          <button onClick={() => { setPaying(null); setEditing('new'); }} data-testid="button-new-billing" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New entry</button>
        </div>
      </header>
      {exportError && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{exportError}</p>}

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium">Year<select data-testid="select-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${fieldClass} mt-1 w-28`}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
        <label className="text-xs font-medium">Month<select data-testid="select-month" value={month ?? ''} onChange={(e) => setMonth(e.target.value === '' ? null : Number(e.target.value))} className={`${fieldClass} mt-1 w-32`}><option value="">Whole year</option>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label>
        <label className="text-xs font-medium">Type<select data-testid="select-kind" value={kind} onChange={(e) => setKind(e.target.value as '' | BillingKind)} className={`${fieldClass} mt-1 w-48`}><option value="">All types</option>{(Object.keys(KIND_LABEL) as BillingKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
        <label className="flex items-center gap-2 pb-2 text-xs font-medium"><input type="checkbox" data-testid="checkbox-show-voided" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Show voided (audit)</label>
      </div>

      <section aria-label="Period totals" className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4 xl:grid-cols-7">
        {([
          ['Fees gross', period.feeGrossCents, 'by work date'], ['Fees net', period.feeNetCents, 'gross x share'], ['Expenses', period.expenseCents, 'by work date'],
          ['Reimbursements', period.reimbursementCents, 'to firm, by work date'], ['Invoiced', period.invoicedCents, 'by invoice date'],
          ['Received', period.receivedCents, 'fees+expenses, by payment date'], ['Reimb. received', period.reimbursementReceivedCents, 'by payment date'],
        ] as const).map(([label, cents, basis]) => (
          <div key={label} className="bg-card px-4 py-3" data-testid={`total-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums">{ledger.isLoading ? '–' : formatUsd(cents)}</p>
            <p className="text-[10px] text-muted-foreground">{basis}</p>
          </div>
        ))}
      </section>
      <p className="mt-1 text-[11px] text-muted-foreground">{month === null ? `All of ${year}` : `${MONTHS[month]} ${year}`}. Voided entries are excluded from every total.</p>
      <p data-testid="text-prebilling-legend" className="mt-2 text-xs text-muted-foreground"><strong>* Pre-billed:</strong> added to billing before completion. Work stays active until filed; the asterisk and pre-billing date remain afterward. Invoice dates are tracked separately. Completion does not create a second charge or move the original billables to another month.</p>

      {editing && <BillingEditor key={editing === 'new' ? 'new' : editing.publicId} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {paying && <PaymentForm key={paying.publicId} item={paying} onClose={() => setPaying(null)} />}

      <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
        {ledger.isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
        : ledger.isError ? <div className="p-8 text-center" role="alert"><AlertTriangle className="mx-auto h-6 w-6 text-rose-700" /><p className="mt-2 text-sm">{errorText(ledger.error, 'The ledger could not be loaded.')}</p><button onClick={() => void ledger.refetch()} data-testid="button-retry-billing" className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Retry</button></div>
        : visible.length === 0 ? <div className="p-10 text-center"><p className="font-display text-lg font-semibold">No entries for this period</p><p className="mt-1 text-sm text-muted-foreground">Pre-billed tasks, filed workflow rows and manual entries appear here by billing/work date.</p></div>
        : <table className="w-full min-w-[1320px] text-left text-sm">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{['Billing / work date', 'Type', 'Client / matter', 'Item', 'Actual completion', 'Gross', 'Share', 'Net', 'Invoice', 'Paid', 'Balance', ''].map((h) => <th key={h} scope="col" className="border-b border-border px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{visible.map((i) => {
            const locked = isLocked(i);
            const canPay = !i.voided && balanceCents(i) > 0 && (i.kind === 'REIMBURSEMENT' || !!i.invoiceNumber);
            return <Fragment key={i.publicId}>
              <tr data-testid={`row-billing-${i.publicId}`} className={`border-b border-border align-top ${i.voided ? 'text-muted-foreground line-through decoration-muted-foreground/50' : ''}`}>
                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{i.workDate}{i.prebilledOn && <span data-testid={`text-prebill-date-${i.publicId}`} className="mt-1 block text-[10px] text-amber-800">Pre-billed* {i.prebilledOn}</span>}</td>
                <td className="px-2 py-2 text-xs"><span className={`rounded-full px-2 py-0.5 font-semibold ${i.kind === 'FEE' ? 'bg-primary/10 text-primary' : i.kind === 'EXPENSE' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{KIND_LABEL[i.kind]}{i.prebilledOn ? '*' : ''}</span>{i.voided && <span className="ml-1 font-semibold no-underline">VOID</span>}{i.workflowPublicId && <span className="mt-1 block text-[10px] text-muted-foreground">From workflow</span>}</td>
                <td className="max-w-[200px] px-2 py-2"><p className="truncate font-medium">{i.client || 'No client'}</p><p className="truncate text-xs text-muted-foreground">{i.matter}</p></td>
                <td className="max-w-[260px] px-2 py-2"><p className="line-clamp-2">{i.description}</p><p className="text-xs text-muted-foreground">{[i.code, i.jurisdiction, i.associate || i.ownerName].filter(Boolean).join(' · ')}</p></td>
                <td data-testid={`text-completion-${i.publicId}`} className="whitespace-nowrap px-2 py-2 text-xs">{i.completedOn ? <span className="font-mono">{i.completedOn}</span> : i.workflowPublicId ? <span className="font-semibold text-amber-800">Active · not completed</span> : <span className="text-muted-foreground">n/a</span>}</td>
                <td className="px-2 py-2 tabular-nums">{formatUsd(i.amountCents)}</td>
                <td className="px-2 py-2 tabular-nums">{i.kind === 'FEE' ? `${(i.shareBasisPoints / 100).toFixed(2)}%` : 'n/a'}</td>
                <td className="px-2 py-2 tabular-nums">{i.kind === 'FEE' ? formatUsd(netCents(i)) : 'n/a'}</td>
                <td className="px-2 py-2 text-xs">{i.invoiceNumber ? <><p className="font-medium">{i.invoiceNumber}</p><p className="text-muted-foreground">{i.invoiceDate}</p></> : <span className="text-muted-foreground">Not invoiced</span>}</td>
                <td className="px-2 py-2 tabular-nums">{i.payments.length ? <button onClick={() => setOpenHistory(openHistory === i.publicId ? null : i.publicId)} data-testid={`button-history-${i.publicId}`} className="underline decoration-dotted">{formatUsd(i.paidCents)}</button> : formatUsd(0)}</td>
                <td className="px-2 py-2 tabular-nums">{formatUsd(balanceCents(i))}</td>
                <td className="whitespace-nowrap px-2 py-2"><div className="flex gap-1">
                  <button onClick={() => { setPaying(null); setEditing(i); }} data-testid={`button-edit-billing-${i.publicId}`} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">{locked || i.voided ? 'Details' : 'Edit'}</button>
                  <button onClick={() => { setEditing(null); setPaying(i); }} disabled={!canPay} title={!canPay && i.kind !== 'REIMBURSEMENT' && !i.invoiceNumber ? 'Add an invoice before recording a receipt' : undefined} data-testid={`button-pay-${i.publicId}`} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40">Record payment</button>
                </div></td>
              </tr>
              {openHistory === i.publicId && <tr className="border-b border-border bg-muted/30"><td colSpan={12} className="px-4 py-2 text-xs" data-testid={`panel-history-${i.publicId}`}>
                <p className="font-semibold">Payment history</p>
                <ul className="mt-1 space-y-0.5">{i.payments.map((p) => <li key={p.publicId} className="tabular-nums">{p.receivedOn} · {formatUsd(p.amountCents)} · {p.reference || 'No reference'}</li>)}</ul>
              </td></tr>}
            </Fragment>;
          })}</tbody>
        </table>}
      </div>

      <section aria-label="Monthly and quarterly summary" className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">{year} by month and quarter</h2><p className="text-xs text-muted-foreground">Billables by work date · invoiced by invoice date · received by payment date</p></div>
        <table className="w-full min-w-[900px] text-right text-sm tabular-nums">
          <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2 text-left">Period</th><th className="px-3 py-2">Fees gross</th><th className="px-3 py-2">Fees net</th><th className="px-3 py-2">Expenses</th><th className="px-3 py-2">Reimb.</th><th className="px-3 py-2">Invoiced</th><th className="px-3 py-2">Received</th><th className="px-3 py-2">Reimb. received</th></tr></thead>
          <tbody>{QUARTERS.map((q, qi) => <Fragment key={q.label}>
            {q.months.map((m) => <SummaryRow key={m} label={MONTHS[m]} t={monthly[m]} />)}
            <SummaryRow label={q.label} t={quarters[qi]} strong />
          </Fragment>)}<SummaryRow label={`${year} total`} t={yearTotals(monthly)} strong /></tbody>
        </table>
      </section>

      <details className="mt-6 rounded-xl border border-dashed border-border bg-card" data-testid="details-legacy-time">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Legacy time entries (earlier hourly records, read for reference)</summary>
        <div className="pt-4"><InternalWorkflowOperations section="finance" /></div>
      </details>
    </div>
  );
}

function SummaryRow({ label, t, strong }: { label: string; t: SummaryTotals; strong?: boolean }) {
  return <tr className={`border-t border-border ${strong ? 'bg-muted/40 font-semibold' : ''}`}>
    <td className="px-3 py-1.5 text-left">{label}</td>
    {[t.feeGrossCents, t.feeNetCents, t.expenseCents, t.reimbursementCents, t.invoicedCents, t.receivedCents, t.reimbursementReceivedCents].map((c, i) => <td key={i} className="px-3 py-1.5">{formatUsd(c)}</td>)}
  </tr>;
}

type Form = { kind: BillingKind; workDate: string; client: string; matter: string; description: string; amount: string; notes: string; code: string; jurisdiction: string; subjectMatter: string; associate: string; sharePercent: string; invoiceNumber: string; invoiceDate: string };
const toForm = (i: FirmBillingItem | null): Form => i ? {
  kind: i.kind, workDate: i.workDate, client: i.client, matter: i.matter, description: i.description, amount: centsToDollarInput(i.amountCents), notes: i.notes, code: i.code,
  jurisdiction: i.jurisdiction, subjectMatter: i.subjectMatter, associate: i.associate, sharePercent: String(i.shareBasisPoints / 100), invoiceNumber: i.invoiceNumber, invoiceDate: i.invoiceDate ?? '',
} : { kind: 'FEE', workDate: today(), client: '', matter: '', description: '', amount: '', notes: '', code: '', jurisdiction: '', subjectMatter: '', associate: '', sharePercent: '100', invoiceNumber: '', invoiceDate: '' };

function BillingEditor({ item, onClose }: { item: FirmBillingItem | null; onClose: () => void }) {
  const create = useCreateFirmBilling();
  const update = useUpdateFirmBilling();
  const [form, setForm] = useState<Form>(() => toForm(item));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const revision = useRef(item?.revision ?? 0);
  const locked = !!item && (item.paidCents > 0 || !!item.invoiceNumber || !!item.invoiceDate);
  const voided = !!item?.voided;
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pending = create.isPending || update.isPending;

  const build = (): FirmBillingInput | string => {
    const amountCents = dollarsToCents(form.amount);
    if (amountCents === null) return 'Enter the amount in dollars, for example 1250.00.';
    const share = Number(form.sharePercent);
    if (!Number.isFinite(share) || share < 0 || share > 100) return 'Share must be between 0 and 100 percent.';
    if (!form.description.trim()) return 'Item description is required.';
    if (!form.workDate) return 'Work date is required.';
    return { kind: form.kind, workDate: form.workDate, client: form.client.trim(), matter: form.matter.trim(), description: form.description.trim(), amountCents, notes: form.notes, code: form.code.trim(), jurisdiction: form.jurisdiction.trim(), subjectMatter: form.subjectMatter.trim(), associate: form.associate.trim(), shareBasisPoints: form.kind === 'FEE' ? Math.round(share * 100) : 10000 };
  };

  const submit = async (event: FormEvent, voidIt = false) => {
    event.preventDefault();
    setError(null); setSaved(null);
    const input = build();
    if (typeof input === 'string') { setError(input); return; }
    if (!!form.invoiceNumber.trim() !== !!form.invoiceDate) { setError('Invoice number and invoice date must both be set or both be blank.'); return; }
    try {
      if (!item) { await create.mutateAsync(input); onClose(); return; }
      await update.mutateAsync({ id: item.publicId, data: { ...input, revision: revision.current, invoiceNumber: form.invoiceNumber.trim(), invoiceDate: form.invoiceDate || null, voided: voidIt || item.voided } });
      onClose();
    } catch (reason) { setError(errorText(reason, 'This entry could not be saved.')); }
  };

  const lockFin = locked || voided;
  return (
    <form onSubmit={(e) => void submit(e)} data-testid="form-billing" className="mt-5 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold">{item ? (voided ? 'Voided entry (audit history)' : 'Edit entry') : 'New ledger entry'}</h2>
          <p className="text-xs text-muted-foreground">{lockFin ? 'Invoiced, paid or voided: kind, date and amounts are locked.' : 'Flat amounts in US dollars. Reimbursements are recovery receipts to the firm, tracked separately from client billables.'}</p></div>
        <button type="button" onClick={onClose} aria-label="Close editor" data-testid="button-close-editor" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <fieldset disabled={voided} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium">Type<select required disabled={lockFin} data-testid="select-billing-kind" value={form.kind} onChange={set('kind')} className={`${fieldClass} mt-1`}>{(Object.keys(KIND_LABEL) as BillingKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
        <label className="text-xs font-medium">Billing / work date<input required type="date" disabled={lockFin} data-testid="input-billing-date" value={form.workDate} onChange={set('workDate')} className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-medium">Amount (USD)<input required inputMode="decimal" disabled={lockFin} data-testid="input-billing-amount" value={form.amount} onChange={set('amount')} placeholder="0.00" className={`${fieldClass} mt-1`} /></label>
        {form.kind === 'FEE' ? <label className="text-xs font-medium">Net share %<input required type="number" min="0" max="100" step="0.01" disabled={lockFin} data-testid="input-billing-share" value={form.sharePercent} onChange={set('sharePercent')} className={`${fieldClass} mt-1`} /></label> : <div />}
        <label className="text-xs font-medium">Client<input maxLength={500} data-testid="input-billing-client" value={form.client} onChange={set('client')} className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-medium">Matter<input maxLength={500} data-testid="input-billing-matter" value={form.matter} onChange={set('matter')} className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-medium sm:col-span-2">Item<input required maxLength={5000} data-testid="input-billing-description" value={form.description} onChange={set('description')} className={`${fieldClass} mt-1`} /></label>
      </fieldset>
      <details className="mt-3" open={!!item}>
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Details: code, jurisdiction, subject matter, associate, notes, invoice</summary>
        <fieldset disabled={voided} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium">Code<input maxLength={100} data-testid="input-billing-code" value={form.code} onChange={set('code')} className={`${fieldClass} mt-1`} /></label>
          <label className="text-xs font-medium">Jurisdiction<input maxLength={100} data-testid="input-billing-jurisdiction" value={form.jurisdiction} onChange={set('jurisdiction')} className={`${fieldClass} mt-1`} /></label>
          <label className="text-xs font-medium">Subject matter<input maxLength={1000} data-testid="input-billing-subject" value={form.subjectMatter} onChange={set('subjectMatter')} className={`${fieldClass} mt-1`} /></label>
          <label className="text-xs font-medium">Associate<input maxLength={240} data-testid="input-billing-associate" value={form.associate} onChange={set('associate')} className={`${fieldClass} mt-1`} /></label>
          <label className="text-xs font-medium sm:col-span-2 lg:col-span-4">Notes<textarea maxLength={10000} rows={2} data-testid="input-billing-notes" value={form.notes} onChange={set('notes')} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm" /></label>
          {item && <>
            <label className="text-xs font-medium">Invoice number<input maxLength={240} disabled={item.paidCents > 0} data-testid="input-invoice-number" value={form.invoiceNumber} onChange={set('invoiceNumber')} className={`${fieldClass} mt-1`} /></label>
            <label className="text-xs font-medium">Invoice date<input type="date" disabled={item.paidCents > 0} data-testid="input-invoice-date" value={form.invoiceDate} onChange={set('invoiceDate')} className={`${fieldClass} mt-1`} /></label>
          </>}
        </fieldset>
      </details>
      {error && <p role="alert" data-testid="status-billing-error" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {saved && <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saved}</p>}
      {!voided && <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} data-testid="button-save-billing" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{pending ? 'Saving' : item ? 'Save changes' : 'Add entry'}</button>
        {item && !locked && <button type="button" disabled={pending} onClick={(e) => { if (window.confirm('Void this entry? It stays in audit history and leaves all totals.')) void submit(e, true); }} data-testid="button-void-billing" className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Void entry</button>}
      </div>}
    </form>
  );
}

function PaymentForm({ item, onClose }: { item: FirmBillingItem; onClose: () => void }) {
  const record = useRecordFirmPayment();
  const balance = balanceCents(item);
  const [amount, setAmount] = useState(centsToDollarInput(balance));
  const [receivedOn, setReceivedOn] = useState(today());
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  // One requestId per submitted attempt; reused on retry of the same values so the server can de-duplicate.
  const attempt = useRef<{ key: string; id: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cents = dollarsToCents(amount);
    if (!cents || cents < 1) { setError('Enter a payment amount greater than zero.'); return; }
    if (cents > balance) { setError(`Payment exceeds the open balance of ${formatUsd(balance)}.`); return; }
    if (item.kind !== 'REIMBURSEMENT' && !item.invoiceNumber) { setError('Fee and expense receipts require an invoice first.'); return; }
    const key = `${cents}|${receivedOn}|${reference}`;
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    try { await record.mutateAsync({ id: item.publicId, data: { amountCents: cents, receivedOn, reference: reference.trim(), requestId: attempt.current.id } }); onClose(); }
    catch (reason) { setError(errorText(reason, 'The payment could not be recorded.')); }
  };

  return (
    <form onSubmit={(e) => void submit(e)} data-testid="form-payment" className="mt-5 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold">Record payment</h2><p className="text-xs text-muted-foreground">{item.description} · {item.client} · open balance {formatUsd(balance)}</p></div>
        <button type="button" onClick={onClose} aria-label="Close payment form" data-testid="button-close-payment" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium">Amount received (USD)<input required inputMode="decimal" data-testid="input-payment-amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-medium">Received on<input required type="date" data-testid="input-payment-date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-medium">Reference<input maxLength={1000} data-testid="input-payment-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check or wire reference" className={`${fieldClass} mt-1`} /></label>
      </div>
      {item.payments.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Prior: {item.payments.map((p) => `${p.receivedOn} ${formatUsd(p.amountCents)}`).join(' · ')}</p>}
      {error && <p role="alert" data-testid="status-payment-error" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      <button type="submit" disabled={record.isPending} data-testid="button-save-payment" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{record.isPending ? 'Recording' : 'Record payment'}</button>
    </form>
  );
}
