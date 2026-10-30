import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { errorText, fieldClass } from '@/components/portal/StaffOnly';
import { useFirmStatusHistory, useUpdateFirmRow } from '@/lib/hooks-firm-operations';
import type { FirmWorkflowStatus } from '@workspace/api-client-react';
import type { RowRevision } from './WorkflowRow';

export const STATUSES = ['Unassigned', 'Assigned', 'Strategy', 'Client Review', 'Drafting', 'Proofing', 'Ready to File', 'Filed', 'On Hold', 'Revisions', 'Client Approved'] as const;

type StageDraft = { date: string; note: string; round: number };

/**
 * Each checked stage records one REACHED event with an explicitly entered date.
 * Recorded stages cannot be unchecked; history is append-only. "Record again" starts a new round.
 */
export function StageChecklist({ id, rev, onDirty }: { id: string; rev: RowRevision; onDirty: (dirty: boolean) => void }) {
  const history = useFirmStatusHistory(id, true);
  const update = useUpdateFirmRow();
  const [drafts, setDrafts] = useState<Record<string, StageDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const events = history.data?.events ?? [];

  const write = (next: Record<string, StageDraft>) => { setDrafts(next); onDirty(Object.keys(next).length > 0); };
  const open = (s: string, round: number) => write({ ...drafts, [s]: { date: '', note: '', round } });
  const close = (s: string) => { const n = { ...drafts }; delete n[s]; write(n); setErrors((e) => ({ ...e, [s]: '' })); };
  const edit = (s: string, k: 'date' | 'note', v: string) => write({ ...drafts, [s]: { ...drafts[s], [k]: v } });

  const saveOne = async (s: string, d: StageDraft): Promise<boolean> => {
    if (!d.date) { setErrors((e) => ({ ...e, [s]: 'Enter the date this stage was reached.' })); return false; }
    const revision = rev.current();
    try {
      await update.mutateAsync({ id, data: { revision, status: s as FirmWorkflowStatus, statusDate: d.date, statusNote: d.note } });
      rev.saved(revision);
      setErrors((e) => ({ ...e, [s]: '' }));
      return true;
    } catch (reason) {
      setErrors((e) => ({ ...e, [s]: errorText(reason, 'This stage could not be recorded.') }));
      return false;
    }
  };

  const save = async (only?: string) => {
    const queue = Object.entries(drafts).filter(([s]) => !only || s === only);
    let remaining = { ...drafts };
    for (const [s, d] of queue) {
      setBusy(s);
      // Sequential: each save waits for the previous to succeed so revisions stay in order.
      const ok = await saveOne(s, d);
      if (!ok) break;
      delete remaining[s]; remaining = { ...remaining };
      write(remaining);
    }
    setBusy(null);
  };

  if (history.isLoading) return <div className="space-y-1.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-7 animate-pulse rounded bg-muted" />)}</div>;
  if (history.isError) return <p role="alert" className="text-xs text-rose-800">{errorText(history.error, 'Stage history could not be loaded.')} <button type="button" onClick={() => void history.refetch()} className="underline">Retry</button></p>;

  const pending = Object.keys(drafts).length;
  return (
    <div data-testid={`stages-${id}`}>
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {STATUSES.map((s) => {
          const hits = events.filter((e) => e.status === s);
          const last = hits[hits.length - 1];
          const d = drafts[s];
          const slug = s.toLowerCase().replace(/\s+/g, '-');
          return (
            <li key={s} className={`px-2.5 py-1.5 ${d ? 'bg-amber-50/70' : ''}`} data-testid={`stage-${slug}-${id}`}>
              <div className="flex items-center gap-2">
                <input type="checkbox" id={`stage-${slug}-${id}`} data-testid={`checkbox-stage-${slug}-${id}`} checked={!!last || !!d}
                  disabled={!!last && !d}
                  title={last ? 'Recorded stages stay in history. Use Record again for a new round.' : undefined}
                  onChange={(e) => (e.target.checked ? open(s, 1) : close(s))} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                <label htmlFor={`stage-${slug}-${id}`} className="flex-1 text-sm font-medium">{s}</label>
                {last && <span className="font-mono text-[11px] tabular-nums text-muted-foreground" data-testid={`text-stage-date-${slug}-${id}`}>{last.statusDate}{hits.length > 1 ? ` · ${hits.length} rounds` : ''}</span>}
                {last && !d && <button type="button" data-testid={`button-stage-again-${slug}-${id}`} onClick={() => open(s, hits.length + 1)} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-muted"><RotateCcw className="h-3 w-3" /> Record again</button>}
              </div>
              {d && <div className="mt-1.5 grid gap-1.5 pl-6 sm:grid-cols-[150px_1fr_auto]">
                <label className="text-[11px] text-muted-foreground">{d.round > 1 ? `Round ${d.round} date reached` : 'Date reached'}
                  <input type="date" required data-testid={`input-stage-date-${slug}-${id}`} value={d.date} onChange={(e) => edit(s, 'date', e.target.value)} className={`${fieldClass} mt-0.5`} /></label>
                <label className="text-[11px] text-muted-foreground">Note
                  <input maxLength={10000} data-testid={`input-stage-note-${slug}-${id}`} value={d.note} onChange={(e) => edit(s, 'note', e.target.value)} className={`${fieldClass} mt-0.5`} /></label>
                <div className="flex items-end gap-1">
                  <button type="button" disabled={!!busy || !d.date} data-testid={`button-stage-save-${slug}-${id}`} onClick={() => void save(s)} className="h-9 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy === s ? 'Saving' : 'Record'}</button>
                  <button type="button" disabled={!!busy} data-testid={`button-stage-cancel-${slug}-${id}`} onClick={() => close(s)} className="h-9 rounded-md border border-border px-2 text-xs">Cancel</button>
                </div>
                {errors[s] && <p role="alert" className="text-xs text-rose-800 sm:col-span-3">{errors[s]}</p>}
              </div>}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {pending > 1 && <button type="button" disabled={!!busy} data-testid={`button-stage-save-all-${id}`} onClick={() => void save()} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50">Record all {pending} in order</button>}
        <span>Stages are optional and can be recorded in any order. Each entry needs the date it was actually reached.</span>
      </div>
    </div>
  );
}
