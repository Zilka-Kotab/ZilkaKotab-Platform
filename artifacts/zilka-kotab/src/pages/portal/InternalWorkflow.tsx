import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Upload } from 'lucide-react';
import { DashboardTabs } from '@/components/portal/DashboardTabs';
import { WorkflowRow, COLS } from '@/components/portal/workflow/WorkflowRow';
import { urgencyDate } from '@/components/portal/workflow/urgency';
import { CsvUpload } from '@/components/portal/workflow/CsvUpload';
import { SEO } from '@/components/SEO';
import { StaffOnly, errorText, fieldClass } from '@/components/portal/StaffOnly';
import { useFirmOperations } from '@/lib/hooks-firm-operations';
import type { FirmWorkflowRow } from '@/lib/hooks-firm-operations';

type View = 'active' | 'completed' | 'all';
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDate(new Date());
const done = (r: FirmWorkflowRow) => !!r.filedOn || r.status === 'Filed';
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); };

export default function InternalWorkflow() {
  return <StaffOnly><DashboardTabs /><WorkflowDashboard /></StaffOnly>;
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
    const active = rows.filter((r) => !done(r));
    return {
      active: active.length,
      overdue: active.filter((r) => { const u = urgencyDate(r); return !!u && u < t; }).length,
      week: active.filter((r) => { const u = urgencyDate(r); return !!u && u >= t && u <= week; }).length,
      priorityReview: active.filter((r) => !!r.priorityDeadline && !!r.dueDate && r.priorityDeadline >= r.dueDate).length,
      unassigned: active.filter((r) => r.assignedToId == null).length,
      filedMonth: rows.filter((r) => r.filedOn && r.filedOn >= monthStart && r.filedOn.slice(0, 7) === t.slice(0, 7)).length,
      byOwner: staff.map((s) => ({ ...s, count: active.filter((r) => r.assignedToId === s.id).length })).filter((s) => s.count > 0),
    };
  }, [rows, staff, t, week, monthStart]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (view === 'active' ? !done(r) : view === 'completed' ? done(r) : true))
      .filter((r) => (owner === '' ? true : owner === 'none' ? r.assignedToId == null : String(r.assignedToId) === owner))
      .filter((r) => !q || [r.title, r.client, r.matter, r.sourceOwner, r.sourceStatus, r.status, r.statusNote, r.dueDate ?? '', r.priorityDeadline ?? ''].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (view === 'completed' ? (b.filedOn ?? b.statusDate ?? '').localeCompare(a.filedOn ?? a.statusDate ?? '') : (urgencyDate(a) ?? '9999').localeCompare(urgencyDate(b) ?? '9999') || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')));
  }, [rows, view, owner, search]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-9">
      <SEO title="Workflow" description="Zilka-Kotab workflow dashboard" url="/portal/internal-workflow" />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Workflow</h1>
          <p className="mt-1 text-sm text-muted-foreground">One row per AppColl task, ordered by the earlier of the internal priority deadline and the official due date. Expand a row to record stages and prepare billing. Filed rows move to Completed and Time &amp; Billing.</p>
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
      {summary.priorityReview > 0 && <p className="mt-2 text-xs text-amber-800" data-testid="text-priority-review">{summary.priorityReview} priority deadline{summary.priorityReview === 1 ? '' : 's'} now fall on or after the official due date after an import. Urgency follows the earlier official date; review those rows.</p>}
      {summary.byOwner.length > 0 && <p className="mt-2 text-xs text-muted-foreground" data-testid="text-owner-load">Active by assignee: {summary.byOwner.map((s) => `${s.name} ${s.count}`).join(' · ')}</p>}

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Row filter" className="flex rounded-lg border border-border bg-card p-0.5">
          {(['active', 'completed', 'all'] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} data-testid={`filter-${v}`} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{v}</button>)}
        </div>
        <label className="text-xs font-medium">Assigned to<select data-testid="select-owner-filter" value={owner} onChange={(e) => setOwner(e.target.value)} className={`${fieldClass} mt-1 min-w-[160px]`}><option value="">Everyone</option><option value="none">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="min-w-[220px] flex-1 text-xs font-medium">Search<input data-testid="input-search-workflow" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client, docket ID, task, owner, status" className={`${fieldClass} mt-1`} /></label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        {ops.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
        ) : ops.isError ? (
          <div className="p-8 text-center" role="alert"><AlertTriangle className="mx-auto h-6 w-6 text-rose-700" /><p className="mt-2 text-sm">{errorText(ops.error, 'The workflow could not be loaded.')}</p><button onClick={() => void ops.refetch()} data-testid="button-retry-workflow" className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Retry</button></div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center"><p className="font-display text-lg font-semibold">{rows.length === 0 ? 'No AppColl tasks yet' : 'Nothing matches this view'}</p><p className="mt-1 text-sm text-muted-foreground">{rows.length === 0 ? 'Upload the AppColl CSV export to populate the sheet.' : 'Adjust the filter, owner or search.'}</p>{rows.length === 0 && <button onClick={() => setUploadOpen(true)} data-testid="button-empty-upload" className="mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Upload CSV</button>}</div>
        ) : (
          <table data-cols={COLS} className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>{['', 'Due / priority', 'Client', 'Docket ID', 'Task', 'Owner', 'Assigned to', 'Status'].map((h) => <th key={h} scope="col" className="border-b border-border px-2 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>{visible.map((r) => <WorkflowRow key={r.publicId} row={r} staff={staff} today={t} isComplete={done(r)} />)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
