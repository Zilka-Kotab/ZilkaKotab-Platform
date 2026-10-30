import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { errorText, fieldClass } from '@/components/portal/StaffOnly';
import { useUpdateFirmRow } from '@/lib/hooks-firm-operations';
import type { FirmWorkflowRow } from '@/lib/hooks-firm-operations';
import type { FirmStaff } from '@workspace/api-client-react';
import { StatusHistory } from './StatusHistory';
import { StageChecklist, STATUSES } from './StageChecklist';
import { BillingPane } from './BillingPane';
import { urgencyDate } from './urgency';

export { STATUSES };
export const COLS = 8;

/** Shared, monotonic revision for every save on one row. Survives refetch races. */
export type RowRevision = { current: () => number; saved: (used: number) => void };
function useRowRevision(serverRevision: number): RowRevision {
  const r = useRef(serverRevision);
  if (serverRevision > r.current) r.current = serverRevision;
  return useRef<RowRevision>({ current: () => r.current, saved: (used) => { r.current = Math.max(r.current, used + 1); } }).current;
}

export function WorkflowRow({ row, staff, today: t, isComplete }: { row: FirmWorkflowRow; staff: FirmStaff[]; today: string; isComplete: boolean }) {
  const update = useUpdateFirmRow();
  const id = row.publicId;
  const ownerLabel = row.sourceOwner || staff.find((s) => s.id === row.sourceOwnerId)?.name || 'n/a';
  const rev = useRowRevision(row.revision);
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState(row.assignedToId == null ? '' : String(row.assignedToId));
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [dirty, setDirty] = useState({ stages: false, billing: false, priority: false });
  useEffect(() => { if (!assignBusy) setAssignError(null); setAssignee(row.assignedToId == null ? '' : String(row.assignedToId)); }, [row.assignedToId]); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = async (v: string) => {
    const prev = assignee;
    setAssignee(v); setAssignError(null); setAssignBusy(true);
    const revision = rev.current();
    try {
      // Assignment only: no status, date or note is sent, so no stage date is fabricated.
      await update.mutateAsync({ id, data: { revision, assignedToId: v ? Number(v) : null } });
      rev.saved(revision);
    } catch (reason) { setAssignee(prev); setAssignError(errorText(reason, 'Assignment could not be saved.')); }
    finally { setAssignBusy(false); }
  };

  const urgent = urgencyDate(row);
  const overdue = !isComplete && !!urgent && urgent < t;
  const officialOverdue = !isComplete && !!row.dueDate && row.dueDate < t;
  const priorityStale = !!row.priorityDeadline && !!row.dueDate && row.priorityDeadline >= row.dueDate;
  const anyDirty = dirty.stages || dirty.billing || dirty.priority;

  return (
    <>
      <tr data-testid={`row-workflow-${id}`} className={`border-b border-border align-top ${open ? 'bg-primary/[0.03]' : 'hover:bg-muted/30'}`}>
        <td className="px-1 py-2">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${row.title}`} data-testid={`button-expand-${id}`} className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {anyDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" />}
          </button>
        </td>
        <td className={`whitespace-nowrap px-2 py-2 font-mono text-xs tabular-nums ${officialOverdue ? 'font-semibold text-rose-700' : ''}`} data-testid={`text-due-${id}`}>
          {row.dueDate ?? 'No date'}
          {officialOverdue && <span className="block text-[10px] uppercase">Overdue</span>}
          {row.priorityDeadline && <span data-testid={`text-priority-${id}`} className={`mt-0.5 block text-[10px] ${priorityStale ? 'text-amber-800' : overdue && !officialOverdue ? 'font-semibold text-rose-700' : 'text-primary'}`}>Priority {row.priorityDeadline}{priorityStale ? ' (review)' : ''}</span>}
        </td>
        <td className="max-w-[180px] px-2 py-2"><p className="truncate font-medium" title={row.client}>{row.client || 'No client'}</p></td>
        <td className="max-w-[150px] px-2 py-2 font-mono text-xs"><span className="block truncate" title={row.matter} data-testid={`text-docket-${id}`}>{row.matter || 'n/a'}</span></td>
        <td className="max-w-[300px] px-2 py-2">
          <p className="line-clamp-2" title={row.title}>{row.title}</p>
          {row.prebilledOn && <p data-testid={`status-prebilled-${id}`} className="mt-0.5 text-[11px] font-semibold text-amber-800">Pre-billed* {row.prebilledOn}{row.prebillVoided ? ' (voided)' : ''}</p>}
        </td>
        <td className="max-w-[140px] px-2 py-2 text-xs"><span className="block truncate" title={ownerLabel} data-testid={`text-source-owner-${id}`}>{ownerLabel}</span></td>
        <td className="px-2 py-1.5">
          <select aria-label={`Assigned to for ${row.title}`} data-testid={`select-assignee-${id}`} value={assignee} disabled={assignBusy} onChange={(e) => void assign(e.target.value)} className={`${fieldClass} w-[150px] ${assignBusy ? 'opacity-60' : ''}`}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          {assignError && <span role="alert" className="mt-0.5 block max-w-[150px] text-[10px] text-rose-700" data-testid={`status-assign-error-${id}`}>{assignError}</span>}
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-xs" data-testid={`text-status-${id}`}>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${row.status === 'Filed' ? 'bg-emerald-100 text-emerald-900' : row.status === 'On Hold' ? 'bg-amber-100 text-amber-900' : 'bg-primary/10 text-primary'}`}>{row.status || 'Unassigned'}</span>
          {row.statusDate && <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{row.statusDate}</span>}
        </td>
      </tr>
      {open && <tr className="border-b border-border bg-muted/20"><td colSpan={COLS} className="px-3 py-4 sm:px-6">
        <ExpandedRow row={row} staff={staff} rev={rev} isComplete={isComplete} today={t} onDirty={(k, v) => setDirty((d) => (d[k] === v ? d : { ...d, [k]: v }))} />
      </td></tr>}
    </>
  );
}

function ExpandedRow({ row, staff, rev, isComplete, today: t, onDirty }: { row: FirmWorkflowRow; staff: FirmStaff[]; rev: RowRevision; isComplete: boolean; today: string; onDirty: (k: 'stages' | 'billing' | 'priority', v: boolean) => void }) {
  const id = row.publicId;
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label="Status" className="space-y-3" data-testid={`pane-status-${id}`}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Status</h3>
          <span className="text-xs">Current <strong className="text-primary">{row.status || 'Unassigned'}</strong>{row.statusDate ? ` since ${row.statusDate}` : ''}</span>
        </div>
        {row.statusNote && <p className="rounded-md bg-card px-2.5 py-1.5 text-xs text-muted-foreground">{row.statusNote}</p>}
        <PriorityDeadline row={row} rev={rev} onDirty={(v) => onDirty('priority', v)} />
        <StageChecklist id={id} rev={rev} onDirty={(v) => onDirty('stages', v)} />
        <Prebill row={row} rev={rev} isComplete={isComplete} today={t} />
        <div>
          <button type="button" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen} data-testid={`button-history-${id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"><History className="h-3.5 w-3.5" />{historyOpen ? 'Hide' : 'Show'} full history ({row.historyCount ?? 0})</button>
          {historyOpen && <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card p-3"><StatusHistory id={id} /></div>}
        </div>
      </section>
      <section aria-label="Billing" className="space-y-2 lg:border-l lg:border-border lg:pl-5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Billing</h3>
        <BillingPane row={row} staff={staff} rev={rev} onDirty={(v) => onDirty('billing', v)} />
      </section>
    </div>
  );
}

function PriorityDeadline({ row, rev, onDirty }: { row: FirmWorkflowRow; rev: RowRevision; onDirty: (v: boolean) => void }) {
  const id = row.publicId;
  const update = useUpdateFirmRow();
  const server = row.priorityDeadline ?? '';
  const [value, setValue] = useState(server);
  const [error, setError] = useState<string | null>(null);
  const lastServer = useRef(server);
  useEffect(() => { setValue((v) => (v === lastServer.current ? server : v)); lastServer.current = server; }, [server]);
  const dirty = value !== server;
  const onDirtyRef = useRef(onDirty); onDirtyRef.current = onDirty;
  useEffect(() => { onDirtyRef.current(dirty); }, [dirty]);
  const stale = !!server && !!row.dueDate && server >= row.dueDate;

  const save = async (next: string | null) => {
    setError(null);
    if (next && row.dueDate && next >= row.dueDate) { setError(`Priority deadline must be earlier than the official due date ${row.dueDate}.`); return; }
    const revision = rev.current();
    try { await update.mutateAsync({ id, data: { revision, priorityDeadline: next } }); rev.saved(revision); lastServer.current = next ?? ''; if (!next) setValue(''); }
    catch (reason) { setError(errorText(reason, 'Priority deadline could not be saved.')); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="text-xs"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Official due</p><p className="font-mono font-semibold tabular-nums">{row.dueDate ?? 'No date'}</p></div>
        <label className="text-[11px] text-muted-foreground">Internal priority deadline
          <input type="date" data-testid={`input-priority-${id}`} value={value} max={row.dueDate ?? undefined} onChange={(e) => setValue(e.target.value)} className={`${fieldClass} mt-0.5 w-[160px] ${dirty ? 'border-amber-500 bg-amber-50' : ''}`} />
        </label>
        <button type="button" disabled={!dirty || !value || update.isPending} onClick={() => void save(value)} data-testid={`button-save-priority-${id}`} className="h-9 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Save</button>
        {server && <button type="button" disabled={update.isPending} onClick={() => void save(null)} data-testid={`button-clear-priority-${id}`} className="h-9 rounded-md border border-border px-2.5 text-xs">Clear</button>}
        {dirty && <button type="button" onClick={() => setValue(server)} className="h-9 text-xs underline">Undo</button>}
      </div>
      {stale && <p className="mt-1.5 text-[11px] text-amber-800" data-testid={`text-priority-review-${id}`}>The official due date moved to {row.dueDate}, on or before this priority deadline. Urgency now follows the official date; review or clear the priority.</p>}
      {error && <p role="alert" className="mt-1.5 text-xs text-rose-800">{error}</p>}
    </div>
  );
}

function Prebill({ row, rev, isComplete, today: t }: { row: FirmWorkflowRow; rev: RowRevision; isComplete: boolean; today: string }) {
  const id = row.publicId;
  const update = useUpdateFirmRow();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(row.prebilledOn ?? t);
  const [error, setError] = useState<string | null>(null);
  if (isComplete || (row.prebilledOn && !row.prebillVoided)) return null;
  const go = async () => {
    setError(null);
    const revision = rev.current();
    try { await update.mutateAsync({ id, data: { revision, prebillOn: date } }); rev.saved(revision); setOpen(false); }
    catch (reason) { setError(errorText(reason, 'Pre-billing could not be saved.')); }
  };
  return (
    <div>
      {!open && <button type="button" data-testid={`button-prebill-${id}`} disabled={update.isPending} title="Add to billing without completing this task" onClick={() => setOpen(true)} className="rounded border border-primary/30 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-40">{row.prebillVoided ? 'Restore pre-bill' : 'Pre-bill'}</button>}
      {open && <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2">
        <label className="block text-xs">Pre-billing date<input type="date" data-testid={`input-prebill-date-${id}`} value={date} disabled={!!row.prebilledOn} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} mt-1 w-[150px]`} /></label>
        <p className="text-[11px] text-muted-foreground">Stays active until filed. Uses the saved billing draft for the fee and allocation.</p>
        <button type="button" data-testid={`button-confirm-prebill-${id}`} disabled={update.isPending || !date} onClick={() => void go()} className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">{update.isPending ? 'Saving' : 'Confirm pre-bill'}</button>
        <button type="button" onClick={() => setOpen(false)} className="ml-2 text-xs underline">Cancel</button>
        {error && <p role="alert" className="text-xs text-rose-800">{error}</p>}
      </div>}
    </div>
  );
}
