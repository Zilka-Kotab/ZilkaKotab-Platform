import { useMemo, useState } from 'react';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import { errorText, fieldClass } from '@/components/portal/StaffOnly';
import { useCreateFirmFeeSchedule, useFirmFeeSchedules } from '@/lib/hooks-firm-operations';
import type { FirmFeeEntryRateType } from '@workspace/api-client-react';
import { duplicateWarnings, finalizeEntries, type FeeDraftEntry } from '@/lib/fee-schedule-parse';
import { readFeeScheduleFile } from '@/lib/fee-schedule-import';
import { centsToDollarInput, dollarsToCents, formatUsd } from '@/lib/firm-billing-summary';

const RATE_LABEL: Record<FirmFeeEntryRateType, string> = { FLAT: 'Flat', HOURLY: 'Hourly', APPROVAL: 'As approved', ADJUSTMENT: 'Adjustment' };
type Row = FeeDraftEntry & { amountText: string };

/** Admin only: import a structured fee schedule. Only reviewed rows are sent; the source file is never stored. */
export function FeeScheduleImport() {
  const schedules = useFirmFeeSchedules();
  const create = useCreateFirmFeeSchedule();
  const [client, setClient] = useState('');
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [nextId, setNextId] = useState(1);
  const dupes = useMemo(() => (rows ? duplicateWarnings(rows) : []), [rows]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setSaved(null); setRows(null); setWarnings([]); setReading(true);
    try {
      const { entries, warnings: w } = await readFeeScheduleFile(file);
      setRows(entries.map((e) => ({ ...e, amountText: e.amountCents != null ? centsToDollarInput(e.amountCents) : '' })));
      setWarnings(w.filter((x) => !x.startsWith('Code ')));
      setFileName(file.name);
      setNextId(entries.length + 1);
      if (!name) setName(file.name.replace(/\.[^.]+$/, '').slice(0, 240));
    } catch (reason) { setError(errorText(reason, 'The file could not be read.')); }
    finally { setReading(false); }
  };

  const edit = (i: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => { setRows((rs) => [...(rs ?? []), { id: `m${nextId}`, code: '', jurisdiction: '', subjectMatter: '', itemShort: '', description: '', rateType: 'FLAT', rateText: '', amountCents: null, amountText: '' }]); setNextId((n) => n + 1); };

  const save = async () => {
    setError(null); setSaved(null);
    if (!client.trim()) { setError('Client is required. It must match the client name on workflow rows.'); return; }
    if (!name.trim()) { setError('Schedule name is required.'); return; }
    if (!rows) return;
    const withAmounts: FeeDraftEntry[] = [];
    for (const [i, r] of rows.entries()) {
      const cents = r.amountText.trim() ? dollarsToCents(r.amountText) : null;
      if (r.amountText.trim() && cents == null) { setError(`Row ${i + 1}: amount must be in dollars, for example 1250.00.`); return; }
      const { amountText: _unused, ...entry } = r; void _unused;
      withAmounts.push({ ...entry, amountCents: cents });
    }
    const entries = finalizeEntries(withAmounts);
    if (typeof entries === 'string') { setError(entries); return; }
    try {
      await create.mutateAsync({ client: client.trim(), name: name.trim(), sourceFileName: fileName.slice(0, 240), entries });
      setSaved(`Saved "${name.trim()}" with ${entries.length} entries for ${client.trim()}.`);
      setRows(null); setName(''); setFileName('');
    } catch (reason) { setError(errorText(reason, 'The schedule could not be saved.')); }
  };

  return (
    <section aria-label="Fee schedules" className="mt-6 rounded-xl border border-border bg-card p-4" data-testid="panel-fee-schedules">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Client fee schedules</h2>
          <p className="max-w-[640px] text-xs text-muted-foreground">Import the fee appendix from a .docx, .xlsx or .csv file (5 MB, 1,000 rows). Only the reviewed table rows are saved as a structured schedule. The agreement itself is not stored or archived here. Schedules cannot be edited after saving; upload a new named version instead. Existing billing drafts keep their selected schedule.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <FileUp className="h-4 w-4" />{reading ? 'Reading' : 'Choose file'}
          <input type="file" accept=".docx,.xlsx,.csv" className="sr-only" data-testid="input-fee-schedule-file" disabled={reading} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>

      {error && <p role="alert" data-testid="status-fee-schedule-error" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {saved && <p role="status" data-testid="status-fee-schedule-saved" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saved}</p>}

      {rows && <div className="mt-4 space-y-3" data-testid="panel-fee-preview">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium">Client (as shown on workflow rows)<input required maxLength={500} data-testid="input-fee-client" value={client} onChange={(e) => setClient(e.target.value)} className={`${fieldClass} mt-1`} /></label>
          <label className="text-xs font-medium">Schedule name / version<input required maxLength={240} data-testid="input-fee-name" value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} mt-1`} /></label>
        </div>
        {[...warnings, ...dupes].length > 0 && <ul className="space-y-0.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="list-fee-warnings">{[...warnings, ...dupes].map((w) => <li key={w}>{w}</li>)}</ul>}
        <p className="text-xs text-muted-foreground">Review {rows.length} rows from {fileName || 'manual entry'}. Hourly, as-approved and adjustment rows keep their rate text; staff enter the flat amount when billing.</p>
        <div className="max-h-[480px] overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"><tr>{['Code', 'Jurisdiction', 'Subject', 'Item', 'Details', 'Rate type', 'Source rate', 'Flat amount', ''].map((h) => <th key={h} className="px-1.5 py-1.5">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.id} className="border-t border-border align-top" data-testid={`row-fee-${r.id}`}>
                <td className="p-1"><input aria-label="Code" value={r.code} maxLength={100} onChange={(e) => edit(i, { code: e.target.value })} className={`${fieldClass} h-8 w-[90px] font-mono`} /></td>
                <td className="p-1"><input aria-label="Jurisdiction" value={r.jurisdiction} maxLength={100} onChange={(e) => edit(i, { jurisdiction: e.target.value })} className={`${fieldClass} h-8 w-[80px]`} /></td>
                <td className="p-1"><input aria-label="Subject matter" value={r.subjectMatter} maxLength={1000} onChange={(e) => edit(i, { subjectMatter: e.target.value })} className={`${fieldClass} h-8 w-[90px]`} /></td>
                <td className="p-1"><input aria-label="Item" value={r.itemShort} maxLength={2000} onChange={(e) => edit(i, { itemShort: e.target.value })} className={`${fieldClass} h-8 w-[200px]`} /></td>
                <td className="p-1"><textarea aria-label="Details" rows={1} value={r.description} maxLength={10000} onChange={(e) => edit(i, { description: e.target.value })} className="w-[220px] resize-y rounded-md border border-border bg-background px-2 py-1" /></td>
                <td className="p-1"><select aria-label="Rate type" value={r.rateType} onChange={(e) => edit(i, { rateType: e.target.value as FirmFeeEntryRateType })} className={`${fieldClass} h-8 w-[110px]`}>{(Object.keys(RATE_LABEL) as FirmFeeEntryRateType[]).map((k) => <option key={k} value={k}>{RATE_LABEL[k]}</option>)}</select></td>
                <td className="p-1"><input aria-label="Source rate text" value={r.rateText} maxLength={500} onChange={(e) => edit(i, { rateText: e.target.value })} className={`${fieldClass} h-8 w-[110px]`} /></td>
                <td className="p-1">{r.rateType === 'FLAT' ? <input aria-label="Flat amount" inputMode="decimal" value={r.amountText} onChange={(e) => edit(i, { amountText: e.target.value })} placeholder="0.00" className={`${fieldClass} h-8 w-[100px] tabular-nums`} /> : <span className="text-muted-foreground">Manual at billing</span>}</td>
                <td className="p-1"><button type="button" aria-label={`Remove row ${i + 1}`} data-testid={`button-remove-fee-${r.id}`} onClick={() => setRows((rs) => rs && rs.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addRow} data-testid="button-add-fee-row" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"><Plus className="h-4 w-4" /> Add row</button>
          <button type="button" onClick={() => void save()} disabled={create.isPending || rows.length === 0} data-testid="button-save-fee-schedule" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{create.isPending ? 'Saving' : `Save schedule (${rows.length})`}</button>
          <button type="button" onClick={() => { setRows(null); setError(null); }} className="rounded-lg border border-border px-3 py-2 text-sm">Discard</button>
        </div>
      </div>}

      <div className="mt-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Saved schedules</h3>
        {schedules.isLoading ? <div className="mt-2 h-12 animate-pulse rounded bg-muted" />
          : schedules.isError ? <p role="alert" className="mt-2 text-xs text-rose-800">{errorText(schedules.error, 'Schedules could not be loaded.')} <button type="button" onClick={() => void schedules.refetch()} className="underline">Retry</button></p>
          : (schedules.data?.schedules.length ?? 0) === 0 ? <p className="mt-2 text-sm text-muted-foreground">No schedules yet. Import a client fee appendix to enable schedule-based billing.</p>
          : <ul className="mt-2 divide-y divide-border text-sm">{schedules.data!.schedules.map((s) => {
            const flat = s.entries.filter((e) => e.rateType === 'FLAT' && e.amountCents != null);
            return <li key={s.publicId} data-testid={`text-fee-schedule-${s.publicId}`} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
              <span><span className="font-medium">{s.client}</span> · {s.name}</span>
              <span className="text-xs text-muted-foreground">{s.entries.length} entries{flat.length ? ` · flat ${formatUsd(Math.min(...flat.map((e) => e.amountCents!)))} to ${formatUsd(Math.max(...flat.map((e) => e.amountCents!)))}` : ''} · {new Date(s.createdAt).toLocaleDateString()}{s.sourceFileName ? ` · from ${s.sourceFileName}` : ''}</span>
            </li>;
          })}</ul>}
      </div>
    </section>
  );
}
