import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, Upload, X } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { StaffOnly, errorText, fieldClass } from '@/components/portal/StaffOnly';
import { useFirmOperations, useImportFirmCsv, useUpdateFirmRow } from '@/lib/hooks-firm-operations';
import type { FirmWorkflowRow, FirmCsvResult } from '@/lib/hooks-firm-operations';
import type { FirmStaff, FirmWorkflowUpdate } from '@workspace/api-client-react';

// Legacy components (InternalWorkflowTasks, InternalWorkflowWorkspace, InternalWorkflowDocketTasks,
// InternalWorkflowOperations) are retained on disk; the six-tab navigation is retired in favour of this single sheet.

type View = 'active' | 'completed' | 'all';
type Draft = { assignedToId: string; strategySentOn: string; clientApprovalSentOn: string; paralegalSentOn: string; filedOn: string; notes: string };
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDate(new Date());
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); };
const toDraft = (r: FirmWorkflowRow): Draft => ({ assignedToId: r.assignedToId == null ? '' : String(r.assignedToId), strategySentOn: r.strategySentOn ?? '', clientApprovalSentOn: r.clientApprovalSentOn ?? '', paralegalSentOn: r.paralegalSentOn ?? '', filedOn: r.filedOn ?? '', notes: r.notes });

export default function InternalWorkflow() {
  return <StaffOnly><WorkflowDashboard /></StaffOnly>;
}

function WorkflowDashboard() {
  const ops = useFirmOperations();
  const [view, setView] = useState<View>('active');
  const [owner, setOwner] = useState('');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(() => new URLSearchParams(window.location.search).get('upload') === '1');
  const rows = useMemo(() => ops.data?.rows ?? [], [ops.data]);
  const staff = ops.data?.staff ?? [];
  const t = today(); const week = addDays(7); const monthStart = t.slice(0, 8) + '01';

  const summary = useMemo(() => {
    const active = rows.filter((r) => !r.filedOn);
    return {
      active: active.length,
      overdue: active.filter((r) => r.dueDate && r.dueDate < t).length,
      week: active.filter((r) => r.dueDate && r.dueDate >= t && r.dueDate <= week).length,
      unassigned: active.filter((r) => r.assignedToId == null).length,
      filedMonth: rows.filter((r) => r.filedOn && r.filedOn >= monthStart && r.filedOn.slice(0, 7) === t.slice(0, 7)).length,
      byOwner: staff.map((s) => ({ ...s, count: active.filter((r) => r.assignedToId === s.id).length })).filter((s) => s.count > 0),
    };
  }, [rows, staff, t, week, monthStart]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (view === 'active' ? !r.filedOn : view === 'completed' ? !!r.filedOn : true))
      .filter((r) => (owner === '' ? true : owner === 'none' ? r.assignedToId == null : String(r.assignedToId) === owner))
      .filter((r) => !q || [r.title, r.client, r.matter, r.sourceOwner, r.sourceStatus, r.notes].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (view === 'completed' ? (b.filedOn ?? '').localeCompare(a.filedOn ?? '') : (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')));
  }, [rows, view, owner, search]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-9">
      <SEO title="Workflow" description="Zilka-Kotab workflow dashboard" url="/portal/internal-workflow" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="portal-eyebrow text-[10px] font-bold uppercase">Firm workflow</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Deadlines and handoffs</h1>
          <p className="mt-1 text-sm text-muted-foreground">One row per AppColl task. Edit dates and owners in place; filed rows move to Completed and Time &amp; Billing.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void ops.refetch()} data-testid="button-refresh-workflow" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"><RefreshCw className={`h-4 w-4 ${ops.isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
          <button type="button" onClick={() => setUploadOpen(true)} data-testid="button-open-upload" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Upload className="h-4 w-4" /> Upload CSV</button>
        </div>
      </header>

      {uploadOpen && <CsvUpload canImport={!!ops.data?.canImport} onClose={() => setUploadOpen(false)} />}

      <section aria-label="Workload summary" className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-5">
        {([['Active', summary.active, ''], ['Overdue', summary.overdue, 'text-rose-700'], ['Due in 7 days', summary.week, 'text-amber-700'], ['Unassigned', summary.unassigned, ''], ['Filed this month', summary.filedMonth, 'text-emerald-700']] as const).map(([label, value, tone]) => (
          <div key={label} className="bg-card px-4 py-3" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
            <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${tone}`}>{ops.isLoading ? '–' : value}</p>
          </div>
        ))}
      </section>
      {summary.byOwner.length > 0 && <p className="mt-2 text-xs text-muted-foreground" data-testid="text-owner-load">Active by owner: {summary.byOwner.map((s) => `${s.name} ${s.count}`).join(' · ')}</p>}

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Row filter" className="flex rounded-lg border border-border bg-card p-0.5">
          {(['active', 'completed', 'all'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} data-testid={`filter-${v}`} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{v}</button>)}
        </div>
        <label className="text-xs font-medium">Owner<select data-testid="select-owner-filter" value={owner} onChange={(e) => setOwner(e.target.value)} className={`${fieldClass} mt-1 min-w-[160px]`}><option value="">Everyone</option><option value="none">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="min-w-[220px] flex-1 text-xs font-medium">Search<input data-testid="input-search-workflow" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client, matter, task, notes" className={`${fieldClass} mt-1`} /></label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        {ops.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
        ) : ops.isError ? (
          <div className="p-8 text-center" role="alert"><AlertTriangle className="mx-auto h-6 w-6 text-rose-700" /><p className="mt-2 text-sm">{errorText(ops.error, 'The workflow could not be loaded.')}</p><button onClick={() => void ops.refetch()} data-testid="button-retry-workflow" className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Retry</button></div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center"><p className="font-display text-lg font-semibold">{rows.length === 0 ? 'No AppColl tasks yet' : 'Nothing matches this view'}</p><p className="mt-1 text-sm text-muted-foreground">{rows.length === 0 ? 'Upload the AppColl CSV export to populate the sheet.' : 'Adjust the filter, owner or search.'}</p>{rows.length === 0 && <button onClick={() => setUploadOpen(true)} data-testid="button-empty-upload" className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Upload CSV</button>}</div>
        ) : (
          <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>{['Due', 'Client / matter', 'Task', 'Source', 'Assigned to', 'Strategy completed/sent', 'Client approval sent', 'Sent to paralegal', 'Filed/completed', 'Notes', ''].map((h) => <th key={h} scope="col" className="border-b border-border px-2 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>{visible.map((r) => <WorkflowRow key={r.publicId} row={r} staff={staff} today={t} />)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function WorkflowRow({ row, staff, today: t }: { row: FirmWorkflowRow; staff: FirmStaff[]; today: string }) {
  const update = useUpdateFirmRow();
  const [draft, setDraft] = useState<Draft>(() => toDraft(row));
  const [error, setError] = useState<string | null>(null);
  const baseRevision = useRef(row.revision);
  const original = toDraft(row);
  const dirtyKeys = (Object.keys(draft) as (keyof Draft)[]).filter((k) => draft[k] !== original[k]);
  const dirty = dirtyKeys.length > 0;
  const [conflict, setConflict] = useState(false);
  const [prebillOpen, setPrebillOpen] = useState(false);
  const [prebillDate, setPrebillDate] = useState(row.prebilledOn ?? t);
  // Clean drafts follow refetched server data; dirty drafts are never overwritten.
  const lastServer = useRef(original);
  useEffect(() => {
    const prev = lastServer.current;
    lastServer.current = toDraft(row);
    setDraft((d) => ((Object.keys(d) as (keyof Draft)[]).every((k) => d[k] === prev[k]) ? toDraft(row) : d));
  }, [row]);
  // Revision is captured when editing starts, so a concurrent save elsewhere is reported, not overwritten.
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => { if (!dirty) baseRevision.current = row.revision; setDraft((d) => ({ ...d, [k]: e.target.value })); };

  const save = async () => {
    setError(null);
    const data: FirmWorkflowUpdate = { revision: baseRevision.current };
    for (const k of dirtyKeys) {
      if (k === 'notes') data.notes = draft.notes;
      else if (k === 'assignedToId') data.assignedToId = draft.assignedToId ? Number(draft.assignedToId) : null;
      else data[k] = draft[k] || null;
    }
    try { await update.mutateAsync({ id: row.publicId, data }); }
    catch (reason) {
      const msg = errorText(reason, 'This row could not be saved.');
      setConflict(/refresh and retry/i.test(msg));
      setError(msg);
    }
  };

  const overdue = !row.filedOn && row.dueDate && row.dueDate < t;
  const id = row.publicId;
  const prebill = async () => {
    setError(null);
    try {
      await update.mutateAsync({ id, data: { revision: row.revision, prebillOn: prebillDate } });
      setPrebillOpen(false);
    } catch (reason) { setError(errorText(reason, 'Pre-billing could not be saved.')); }
  };
  const dateCell = (k: 'strategySentOn' | 'clientApprovalSentOn' | 'paralegalSentOn' | 'filedOn', label: string) => (
    <td className="px-2 py-1.5"><input type="date" aria-label={`${label} for ${row.title}`} data-testid={`input-${k}-${id}`} value={draft[k]} onChange={set(k)} className={`${fieldClass} w-[140px] ${draft[k] !== original[k] ? 'border-amber-500 bg-amber-50' : ''}`} /></td>
  );

  return (
    <>
      <tr data-testid={`row-workflow-${id}`} className={`border-b border-border align-top ${dirty ? 'bg-amber-50/40' : 'hover:bg-muted/30'}`}>
        <td className={`whitespace-nowrap px-2 py-2 font-mono text-xs tabular-nums ${overdue ? 'font-semibold text-rose-700' : ''}`}>{row.dueDate ?? 'No date'}{overdue && <span className="block text-[10px] uppercase">Overdue</span>}</td>
        <td className="max-w-[180px] px-2 py-2"><p className="truncate font-medium" title={row.client}>{row.client || 'No client'}</p><p className="truncate text-xs text-muted-foreground" title={row.matter}>{row.matter}</p></td>
        <td className="max-w-[240px] px-2 py-2">
          <p className="line-clamp-2" title={row.title}>{row.title}</p>
          {row.prebilledOn && <p data-testid={`status-prebilled-${id}`} className="mt-1 text-xs font-semibold text-amber-800">Pre-billed* {row.prebilledOn}{row.prebillVoided ? ' (voided)' : ''}</p>}
          {!row.filedOn && (!row.prebilledOn || row.prebillVoided) && <button type="button" data-testid={`button-prebill-${id}`} disabled={dirty || update.isPending} title={dirty ? 'Save or undo your row changes before pre-billing.' : 'Add to billing without completing this task'} onClick={() => setPrebillOpen(!prebillOpen)} className="mt-1 rounded border border-primary/30 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-40">{row.prebillVoided ? 'Restore pre-bill' : 'Pre-bill'}</button>}
          {prebillOpen && !row.filedOn && <div className="mt-2 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2">
            <label className="block text-xs">Pre-billing date<input type="date" aria-label={`Pre-billing date for ${row.title}`} data-testid={`input-prebill-date-${id}`} value={prebillDate} disabled={!!row.prebilledOn} onChange={(e) => setPrebillDate(e.target.value)} className={`${fieldClass} mt-1 w-[140px]`} /></label>
            <p className="text-[11px] text-muted-foreground">Stays active until filed. Set the fee and invoice in Time &amp; Billing.</p>
            <button type="button" data-testid={`button-confirm-prebill-${id}`} disabled={dirty || update.isPending || !prebillDate} onClick={() => void prebill()} className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">{update.isPending ? 'Saving' : 'Confirm pre-bill'}</button>
            <button type="button" onClick={() => setPrebillOpen(false)} className="ml-2 text-xs underline">Cancel</button>
          </div>}
        </td>
        <td className="max-w-[150px] px-2 py-2 text-xs text-muted-foreground"><span className="block truncate" title={row.source}>{row.source}</span><span className="block truncate" title={row.sourceStatus}>Status: {row.sourceStatus || 'n/a'}</span><span className="block truncate" title={row.sourceOwner}>Owner: {row.sourceOwner || 'n/a'}</span></td>
        <td className="px-2 py-1.5"><select aria-label={`Assigned to for ${row.title}`} data-testid={`select-assignee-${id}`} value={draft.assignedToId} onChange={set('assignedToId')} className={`${fieldClass} w-[150px] ${draft.assignedToId !== original.assignedToId ? 'border-amber-500 bg-amber-50' : ''}`}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
        {dateCell('strategySentOn', 'Strategy completed/sent')}
        {dateCell('clientApprovalSentOn', 'Client approval sent')}
        {dateCell('paralegalSentOn', 'Sent to paralegal')}
        {dateCell('filedOn', 'Filed/completed')}
        <td className="px-2 py-1.5"><textarea aria-label={`Notes for ${row.title}`} data-testid={`input-notes-${id}`} rows={1} maxLength={10000} value={draft.notes} onChange={set('notes')} className={`w-[220px] resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm ${draft.notes !== original.notes ? 'border-amber-500 bg-amber-50' : ''}`} /></td>
        <td className="whitespace-nowrap px-2 py-1.5">
          {dirty && <div className="flex gap-1">
            <button type="button" onClick={() => void save()} disabled={update.isPending} data-testid={`button-save-row-${id}`} className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">{update.isPending ? 'Saving' : 'Save'}</button>
            <button type="button" onClick={() => { setDraft(original); setError(null); setConflict(false); }} aria-label="Discard changes" data-testid={`button-discard-row-${id}`} className="rounded-md border border-border px-2 py-1.5 text-xs">Undo</button>
          </div>}
        </td>
      </tr>
      {error && <tr><td colSpan={11} role="alert" data-testid={`status-row-error-${id}`} className="border-b border-border bg-rose-50 px-3 py-2 text-xs text-rose-800">
        {error}
        {conflict && <span className="ml-2 inline-flex flex-wrap gap-2">
          <span>Latest saved values: assigned {staff.find((s) => s.id === row.assignedToId)?.name ?? 'unassigned'}, strategy {row.strategySentOn ?? 'blank'}, approval {row.clientApprovalSentOn ?? 'blank'}, paralegal {row.paralegalSentOn ?? 'blank'}, filed {row.filedOn ?? 'blank'}.</span>
          <button type="button" data-testid={`button-reapply-row-${id}`} onClick={() => { baseRevision.current = row.revision; setConflict(false); setError('Your edits will be saved over the refreshed record when you click Save. Review them first.'); }} className="rounded border border-rose-300 bg-card px-2 py-0.5 font-semibold">I refreshed: keep my edits and review</button>
        </span>}
      </td></tr>}
    </>
  );
}

function CsvUpload({ canImport, onClose }: { canImport: boolean; onClose: () => void }) {
  const importCsv = useImportFirmCsv();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<FirmCsvResult | null>(null);
  const [done, setDone] = useState<FirmCsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    setPreview(null); setDone(null); setError(null);
    if (!f) return;
    const text = await f.text();
    setFile({ name: f.name, text });
    try { setPreview(await importCsv.mutateAsync({ fileName: f.name, csvText: text, preview: true })); }
    catch (reason) { setError(errorText(reason, 'The CSV could not be previewed.')); }
  };
  const apply = async () => {
    if (!file) return;
    setError(null);
    try { const result = await importCsv.mutateAsync({ fileName: file.name, csvText: file.text, preview: false }); if (result.errors.length) { setPreview(result); } else { setDone(result); setPreview(null); } }
    catch (reason) { setError(errorText(reason, 'The import could not be applied.')); }
  };

  return (
    <section aria-label="Upload AppColl CSV" data-testid="panel-upload" className="mt-5 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold">Upload AppColl CSV</h2><p className="text-xs text-muted-foreground">Preview first. Any row error blocks the whole import; existing rows are updated, new tasks added.</p></div>
        <button onClick={onClose} aria-label="Close upload" data-testid="button-close-upload" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      {!canImport ? <p className="mt-3 text-sm text-muted-foreground" data-testid="text-import-not-allowed">Your role cannot import CSV files. Ask an administrator to upload the latest AppColl export.</p> : <>
        <label className="mt-3 block text-xs font-medium">CSV file<input type="file" accept=".csv,text/csv" data-testid="input-csv-file" onChange={(e) => void pick(e.target.files?.[0])} className="mt-1 block text-sm" /></label>
        {importCsv.isPending && <p className="mt-3 text-sm text-muted-foreground" role="status">Checking file…</p>}
        {error && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {preview && <div className="mt-3" data-testid="panel-import-preview">
          <p className="text-sm"><b>{preview.added}</b> new, <b>{preview.updated}</b> updated{preview.errors.length > 0 && <>, <b className="text-rose-700">{preview.errors.length} errors</b></>}.</p>
          {preview.errors.length > 0 && <ul className="mt-2 max-h-40 list-disc overflow-auto rounded-md bg-rose-50 py-2 pl-6 pr-3 text-xs text-rose-800">{preview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {preview.rows.length > 0 && <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border text-xs"><table className="w-full"><thead className="bg-muted/50"><tr><th className="p-1.5 text-left">AppColl ID</th><th className="p-1.5 text-left">Client</th><th className="p-1.5 text-left">Matter</th><th className="p-1.5 text-left">Task</th></tr></thead><tbody>{preview.rows.slice(0, 200).map((r) => <tr key={r.externalId} className="border-t border-border"><td className="p-1.5 font-mono">{r.externalId}</td><td className="p-1.5">{r.client}</td><td className="p-1.5">{r.matter}</td><td className="p-1.5">{r.title}</td></tr>)}</tbody></table></div>}
          <button onClick={() => void apply()} disabled={preview.errors.length > 0 || importCsv.isPending} data-testid="button-apply-import" className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{preview.errors.length > 0 ? 'Fix errors to import' : 'Apply import'}</button>
        </div>}
        {done && <p role="status" data-testid="status-import-done" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Imported: {done.added} added, {done.updated} updated.</p>}
      </>}
    </section>
  );
}
