import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { errorText, fieldClass } from '@/components/portal/StaffOnly';
import { useUpdateFirmRow } from '@/lib/hooks-firm-operations';
import type { FirmWorkflowRow } from '@/lib/hooks-firm-operations';
import type { FirmStaff, FirmWorkflowStatus, FirmWorkflowUpdate } from '@workspace/api-client-react';
import { StatusHistory } from './StatusHistory';

export const STATUSES = ['Unassigned', 'Assigned', 'Strategy', 'Client Review', 'Drafting', 'Proofing', 'Ready to File', 'Filed', 'On Hold', 'Revisions', 'Client Approved'] as const;
export const COLS = 9;

type Draft = { assignedToId: string; status: string; statusDate: string; statusNote: string };
const toDraft = (r: FirmWorkflowRow, t: string): Draft => ({
  assignedToId: r.assignedToId == null ? '' : String(r.assignedToId),
  status: r.status || 'Unassigned',
  statusDate: r.statusDate ?? t,
  statusNote: r.statusNote ?? '',
});
const same = (a: Draft, b: Draft) => (Object.keys(a) as (keyof Draft)[]).every((k) => a[k] === b[k]);

export function WorkflowRow({ row, staff, today: t, isComplete }: { row: FirmWorkflowRow; staff: FirmStaff[]; today: string; isComplete: boolean }) {
  const update = useUpdateFirmRow();
  const id = row.publicId;
  const original = toDraft(row, t);
  const [draft, setDraft] = useState<Draft>(original);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prebillOpen, setPrebillOpen] = useState(false);
  const [prebillDate, setPrebillDate] = useState(row.prebilledOn ?? t);
  const baseRevision = useRef(row.revision);
  const latestRevision = useRef(row.revision);
  latestRevision.current = row.revision;
  const editing = useRef(false);
  const dirty = !same(draft, original);

  // Clean drafts follow refetched server data; drafts being edited are preserved.
  const lastServer = useRef(original);
  useEffect(() => {
    const prev = lastServer.current;
    const next = toDraft(row, t);
    lastServer.current = next;
    setDraft((d) => (!editing.current || same(d, prev) ? next : d));
    if (!editing.current) baseRevision.current = row.revision;
  }, [row, t]);

  const set = (k: keyof Draft) => (e: { target: { value: string } }) => {
    if (!editing.current) { baseRevision.current = row.revision; editing.current = true; }
    setSaved(false);
    const v = e.target.value;
    setDraft((d) => {
      const n = { ...d, [k]: v };
      if (k === 'assignedToId') {
        if (v && d.status === 'Unassigned') n.status = 'Assigned';
        else if (!v && d.status === 'Assigned') n.status = 'Unassigned';
      }
      if (n.status !== d.status) { n.statusDate = t; n.statusNote = ''; }
      return n;
    });
  };

  const save = async () => {
    setError(null); setSaved(false);
    const data: FirmWorkflowUpdate = { revision: baseRevision.current, status: draft.status as FirmWorkflowStatus, ...(draft.statusDate ? { statusDate: draft.statusDate } : {}), statusNote: draft.statusNote };
    if (draft.assignedToId !== original.assignedToId) data.assignedToId = draft.assignedToId ? Number(draft.assignedToId) : null;
    try {
      await update.mutateAsync({ id, data });
      baseRevision.current = Math.max(latestRevision.current, data.revision + 1);
      editing.current = false; setConflict(false); setSaved(true);
    } catch (reason) {
      const msg = errorText(reason, 'This status could not be saved.');
      setConflict(/refresh and retry/i.test(msg));
      setError(msg);
    }
  };

  const prebill = async () => {
    setError(null);
    try { await update.mutateAsync({ id, data: { revision: row.revision, prebillOn: prebillDate } }); setPrebillOpen(false); }
    catch (reason) { setError(errorText(reason, 'Pre-billing could not be saved.')); }
  };

  const overdue = !isComplete && row.dueDate && row.dueDate < t;
  const hl = (k: keyof Draft) => (draft[k] !== original[k] ? 'border-amber-500 bg-amber-50' : '');
  const count = row.historyCount ?? 0;

  return (
    <>
      <tr data-testid={`row-workflow-${id}`} className={`border-b border-border align-top ${dirty ? 'bg-amber-50/40' : 'hover:bg-muted/30'}`}>
        <td className="px-1 py-2">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Status history for ${row.title}`} data-testid={`button-history-${id}`} className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}<span className="font-mono tabular-nums">{count}</span>
          </button>
        </td>
        <td className={`whitespace-nowrap px-2 py-2 font-mono text-xs tabular-nums ${overdue ? 'font-semibold text-rose-700' : ''}`}>{row.dueDate ?? 'No date'}{overdue && <span className="block text-[10px] uppercase">Overdue</span>}</td>
        <td className="max-w-[180px] px-2 py-2"><p className="truncate font-medium" title={row.client}>{row.client || 'No client'}</p><p className="truncate text-xs text-muted-foreground" title={row.matter}>{row.matter}</p></td>
        <td className="max-w-[240px] px-2 py-2">
          <p className="line-clamp-2" title={row.title}>{row.title}</p>
          {row.prebilledOn && <p data-testid={`status-prebilled-${id}`} className="mt-1 text-xs font-semibold text-amber-800">Pre-billed* {row.prebilledOn}{row.prebillVoided ? ' (voided)' : ''}</p>}
          {!isComplete && (!row.prebilledOn || row.prebillVoided) && <button type="button" data-testid={`button-prebill-${id}`} disabled={dirty || update.isPending} title={dirty ? 'Save or undo your status changes before pre-billing.' : 'Add to billing without completing this task'} onClick={() => setPrebillOpen(!prebillOpen)} className="mt-1 rounded border border-primary/30 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-40">{row.prebillVoided ? 'Restore pre-bill' : 'Pre-bill'}</button>}
          {prebillOpen && !isComplete && <div className="mt-2 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-2">
            <label className="block text-xs">Pre-billing date<input type="date" data-testid={`input-prebill-date-${id}`} value={prebillDate} disabled={!!row.prebilledOn} onChange={(e) => setPrebillDate(e.target.value)} className={`${fieldClass} mt-1 w-[140px]`} /></label>
            <p className="text-[11px] text-muted-foreground">Stays active until filed. Set the fee and invoice in Time &amp; Billing.</p>
            <button type="button" data-testid={`button-confirm-prebill-${id}`} disabled={dirty || update.isPending || !prebillDate} onClick={() => void prebill()} className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40">{update.isPending ? 'Saving' : 'Confirm pre-bill'}</button>
            <button type="button" onClick={() => setPrebillOpen(false)} className="ml-2 text-xs underline">Cancel</button>
          </div>}
        </td>
        <td className="max-w-[150px] px-2 py-2 text-xs text-muted-foreground"><span className="block truncate" title={row.source}>{row.source}</span><span className="block truncate" title={row.sourceStatus}>Status: {row.sourceStatus || 'n/a'}</span><span className="block truncate" title={row.sourceOwner}>Owner: {row.sourceOwner || 'n/a'}</span></td>
        <td className="px-2 py-1.5"><select aria-label={`Assigned to for ${row.title}`} data-testid={`select-assignee-${id}`} value={draft.assignedToId} onChange={set('assignedToId')} className={`${fieldClass} w-[150px] ${hl('assignedToId')}`}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
        <td className="px-2 py-1.5">
          <select aria-label={`Status for ${row.title}`} data-testid={`select-status-${id}`} value={draft.status} onChange={set('status')} className={`${fieldClass} w-[150px] font-medium ${hl('status')}`}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <input type="date" aria-label={`Date reached for ${row.title}`} data-testid={`input-status-date-${id}`} value={draft.statusDate} onChange={set('statusDate')} className={`${fieldClass} mt-1 w-[150px] ${hl('statusDate')}`} />
          {!row.statusDate && <span className="mt-0.5 block text-[10px] text-muted-foreground">Date defaults to today</span>}
        </td>
        <td className="px-2 py-1.5"><textarea aria-label={`Note for ${row.title}`} data-testid={`input-status-note-${id}`} rows={2} maxLength={10000} value={draft.statusNote} onChange={set('statusNote')} placeholder="Note for this update" className={`w-[240px] resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm ${hl('statusNote')}`} /></td>
        <td className="whitespace-nowrap px-2 py-1.5">
          <button type="button" onClick={() => void save()} disabled={update.isPending || !draft.status} data-testid={`button-save-status-${id}`} title="Each save logs a new status entry, even if nothing changed" className={`rounded-md px-2.5 py-1.5 text-xs font-semibold disabled:opacity-60 ${dirty ? 'bg-primary text-primary-foreground' : 'border border-primary/30 text-primary hover:bg-primary/5'}`}>{update.isPending ? 'Saving' : dirty ? 'Save status' : 'Log another update'}</button>
          {dirty && <button type="button" onClick={() => { setDraft(original); editing.current = false; setError(null); setConflict(false); }} data-testid={`button-discard-row-${id}`} className="ml-1 rounded-md border border-border px-2 py-1.5 text-xs">Undo</button>}
          {saved && !dirty && <span className="mt-1 block text-[10px] text-emerald-700" role="status" data-testid={`status-saved-${id}`}>Logged</span>}
        </td>
      </tr>
      {error && <tr><td colSpan={COLS} role="alert" data-testid={`status-row-error-${id}`} className="border-b border-border bg-rose-50 px-3 py-2 text-xs text-rose-800">
        {error}
        {conflict && <span className="ml-2 inline-flex flex-wrap gap-2">
          <span>Latest saved: {row.status || 'Unassigned'} {row.statusDate ?? ''}, assigned {staff.find((s) => s.id === row.assignedToId)?.name ?? 'unassigned'}.</span>
          <button type="button" data-testid={`button-reapply-row-${id}`} onClick={() => { baseRevision.current = row.revision; setConflict(false); setError('Your entries will be logged against the refreshed record when you save. Review them first.'); }} className="rounded border border-rose-300 bg-card px-2 py-0.5 font-semibold">I refreshed: keep my entries and review</button>
        </span>}
      </td></tr>}
      {open && <tr className="border-b border-border bg-muted/25"><td colSpan={COLS} className="px-10 py-3"><StatusHistory id={id} /></td></tr>}
    </>
  );
}
