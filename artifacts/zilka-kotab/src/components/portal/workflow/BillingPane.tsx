import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { errorText, fieldClass } from '@/components/portal/StaffOnly';
import { useFirmFeeSchedules, useUpdateFirmRow } from '@/lib/hooks-firm-operations';
import type { FirmWorkflowRow } from '@/lib/hooks-firm-operations';
import type { FirmStaff, FirmWorkflowBilling } from '@workspace/api-client-react';
import { centsToDollarInput, dollarsToCents, formatUsd } from '@/lib/firm-billing-summary';
import { sameClient } from '@/lib/fee-schedule-parse';
import { allocate, bpToPercent, percentToBp } from '@/lib/workflow-billing';
import type { RowRevision } from './WorkflowRow';

type Form = {
  scheduleId: string; entryId: string; code: string; jurisdiction: string; subjectMatter: string; itemShort: string; description: string; details: string; notes: string;
  amount: string; ownerId: string; ownerMode: 'percent' | 'fixed'; ownerPercent: string; ownerFixed: string; assigneeId: string; assigneePercent: string;
};

const fromDraft = (row: FirmWorkflowRow): Form => {
  const d = row.billingDraft;
  if (d) return {
    scheduleId: d.scheduleId ?? '', entryId: d.entryId ?? '', code: d.code, jurisdiction: d.jurisdiction, subjectMatter: d.subjectMatter, itemShort: d.itemShort,
    description: d.description, details: d.details, notes: d.notes, amount: centsToDollarInput(d.amountCents), ownerId: String(d.ownerId),
    ownerMode: d.ownerFixedCents != null ? 'fixed' : 'percent', ownerPercent: bpToPercent(d.ownerShareBasisPoints), ownerFixed: d.ownerFixedCents != null ? centsToDollarInput(d.ownerFixedCents) : '',
    assigneeId: d.assigneeId == null ? '' : String(d.assigneeId), assigneePercent: bpToPercent(d.assigneeShareBasisPoints),
  };
  // New draft: no invented allocation. Owner only from a known source owner; otherwise explicit selection required.
  return {
    scheduleId: '', entryId: '', code: '', jurisdiction: '', subjectMatter: '', itemShort: row.title.slice(0, 2000), description: '', details: '', notes: '', amount: '',
    ownerId: row.sourceOwnerId != null ? String(row.sourceOwnerId) : '', ownerMode: 'percent', ownerPercent: '0', ownerFixed: '',
    assigneeId: row.assignedToId != null ? String(row.assignedToId) : '', assigneePercent: '0',
  };
};
const same = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);

export function BillingPane({ row, staff, rev, onDirty }: { row: FirmWorkflowRow; staff: FirmStaff[]; rev: RowRevision; onDirty: (dirty: boolean) => void }) {
  const id = row.publicId;
  const update = useUpdateFirmRow();
  const schedulesQ = useFirmFeeSchedules();
  const server = fromDraft(row);
  const [form, setForm] = useState<Form>(server);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const lastServer = useRef(server);
  const dirty = !same(form, lastServer.current);
  const locked = !!row.billingLocked;
  const onDirtyRef = useRef(onDirty); onDirtyRef.current = onDirty;
  useEffect(() => { onDirtyRef.current(dirty); }, [dirty]);

  // Follow refetched server draft only while the user has no unsaved edits.
  useEffect(() => {
    const next = fromDraft(row);
    setForm((f) => (same(f, lastServer.current) ? next : f));
    lastServer.current = next;
  }, [row]);

  const schedules = useMemo(() => (schedulesQ.data?.schedules ?? []).filter((s) => sameClient(s.client, row.client)), [schedulesQ.data, row.client]);
  const schedule = schedules.find((s) => s.publicId === form.scheduleId);
  const entry = schedule?.entries.find((e) => e.id === form.entryId);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => { setSaved(false); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const pickEntry = (entryId: string) => {
    setSaved(false);
    const e = schedule?.entries.find((x) => x.id === entryId);
    setForm((f) => !e ? { ...f, entryId: '' } : {
      ...f, entryId, code: e.code, jurisdiction: e.jurisdiction, subjectMatter: e.subjectMatter, itemShort: e.itemShort, description: e.description,
      amount: e.rateType === 'FLAT' && e.amountCents != null ? centsToDollarInput(e.amountCents) : '',
    });
  };

  const gross = dollarsToCents(form.amount);
  const ownerBp = percentToBp(form.ownerPercent);
  const ownerFixed = form.ownerMode === 'fixed' ? dollarsToCents(form.ownerFixed) : null;
  const assigneeBp = percentToBp(form.assigneePercent);
  const calc = gross != null && ownerBp != null && assigneeBp != null ? allocate(gross, { ownerShareBasisPoints: form.ownerMode === 'fixed' ? 0 : ownerBp, ownerFixedCents: ownerFixed, assigneeShareBasisPoints: form.assigneeId ? assigneeBp : 0 }) : null;
  const name = (v: string) => staff.find((s) => String(s.id) === v)?.name ?? (v ? `User ${v}` : 'Not selected');

  const build = (): FirmWorkflowBilling | string => {
    if (entry?.rateType === 'ADJUSTMENT') return 'A courtesy markdown is not an additional charge. Choose the substantive service and enter its final approved gross fee after the discount.';
    if (!form.itemShort.trim()) return 'Item is required.';
    if (gross == null) return 'Enter the flat fee in dollars, for example 1250.00.';
    if (!form.ownerId) return 'Select the billing owner.';
    if (ownerBp == null || assigneeBp == null) return 'Shares must be between 0 and 100 percent.';
    if (form.ownerMode === 'fixed' && ownerFixed == null) return 'Enter the owner fixed amount in dollars.';
    if (!calc || calc.over) return 'Owner and assignee allocations exceed the gross fee.';
    if (form.assigneeId && form.assigneeId === form.ownerId && calc.ownerCents > 0 && calc.assigneeCents > 0) return 'Owner and assignee cannot be the same person when both receive an allocation.';
    return {
      scheduleId: form.scheduleId || null, entryId: form.scheduleId && form.entryId ? form.entryId : null,
      code: form.code.trim(), jurisdiction: form.jurisdiction.trim(), subjectMatter: form.subjectMatter.trim(), itemShort: form.itemShort.trim(),
      description: form.description, details: form.details, notes: form.notes, amountCents: gross,
      ownerId: Number(form.ownerId), ownerShareBasisPoints: form.ownerMode === 'fixed' ? 0 : ownerBp, ownerFixedCents: form.ownerMode === 'fixed' ? ownerFixed : null,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null, assigneeShareBasisPoints: form.assigneeId ? assigneeBp : 0,
    };
  };

  const save = async () => {
    setError(null); setSaved(false);
    const draft = build();
    if (typeof draft === 'string') { setError(draft); return; }
    const revision = rev.current();
    try {
      await update.mutateAsync({ id, data: { revision, billingDraft: draft } });
      rev.saved(revision);
      lastServer.current = form; setSaved(true);
    } catch (reason) { setError(errorText(reason, 'The billing draft could not be saved.')); }
  };

  const L = 'text-[11px] font-medium text-muted-foreground';
  return (
    <div data-testid={`billing-pane-${id}`} className="space-y-3">
      {locked && <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900" data-testid={`text-billing-locked-${id}`}><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />Invoiced or paid in Time &amp; Billing. Amount, schedule and allocations are locked; descriptive fields remain editable.</p>}
      {!row.billingDraft && <p className="text-[11px] text-muted-foreground">No billing draft yet. Saving a draft does not pre-bill or invoice.</p>}

      <fieldset disabled={locked} className="grid gap-2 sm:grid-cols-2">
        <label className={L}>Fee schedule
          <select data-testid={`select-billing-schedule-${id}`} value={form.scheduleId} onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, scheduleId: e.target.value, entryId: '' })); }} className={`${fieldClass} mt-0.5`}>
            <option value="">Manual (no schedule)</option>
            {schedules.map((s) => <option key={s.publicId} value={s.publicId}>{s.name} · {new Date(s.createdAt).toLocaleDateString()}</option>)}
            {form.scheduleId && !schedule && <option value={form.scheduleId}>Saved schedule (not available to you)</option>}
          </select>
        </label>
        <label className={L}>Schedule entry
          <select data-testid={`select-billing-entry-${id}`} value={form.entryId} disabled={!schedule} onChange={(e) => pickEntry(e.target.value)} className={`${fieldClass} mt-0.5`}>
            <option value="">{schedule ? 'Choose an entry' : schedulesQ.isLoading ? 'Loading schedules' : schedules.length ? 'Pick a schedule first' : 'No schedule for this client'}</option>
            {schedule?.entries.map((e) => <option key={e.id} value={e.id}>{e.code} · {e.itemShort.slice(0, 60)} · {e.rateText || e.rateType}</option>)}
          </select>
        </label>
      </fieldset>
      {entry && entry.rateType !== 'FLAT' && <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs" data-testid={`text-entry-rate-${id}`}>Schedule rate: <strong>{entry.rateText || entry.rateType}</strong>. {entry.rateType === 'ADJUSTMENT' ? 'Reference only: a courtesy markdown is not an additional fee. Choose the substantive service and enter the discounted final gross fee instead.' : entry.rateType === 'HOURLY' ? 'Hourly rate shown for reference only; enter the total flat amount below.' : 'Enter the agreed flat amount manually.'}</p>}

      <div className="grid gap-2 sm:grid-cols-3">
        <label className={L}>Code<input disabled={locked} maxLength={100} data-testid={`input-billing-code-${id}`} value={form.code} onChange={set('code')} className={`${fieldClass} mt-0.5`} /></label>
        <label className={L}>Jurisdiction<input disabled={locked} maxLength={100} value={form.jurisdiction} onChange={set('jurisdiction')} className={`${fieldClass} mt-0.5`} /></label>
        <label className={L}>Subject matter<input disabled={locked} maxLength={1000} value={form.subjectMatter} onChange={set('subjectMatter')} className={`${fieldClass} mt-0.5`} /></label>
        <label className={`${L} sm:col-span-3`}>Item<input maxLength={2000} data-testid={`input-billing-item-${id}`} value={form.itemShort} onChange={set('itemShort')} className={`${fieldClass} mt-0.5`} /></label>
        <label className={`${L} sm:col-span-3`}>Description<textarea rows={2} maxLength={10000} value={form.description} onChange={set('description')} className="mt-0.5 w-full rounded-md border border-border bg-background p-2 text-sm" /></label>
        <label className={`${L} sm:col-span-2`}>Details<input maxLength={10000} value={form.details} onChange={set('details')} className={`${fieldClass} mt-0.5`} /></label>
        <label className={L}>Notes<input maxLength={10000} value={form.notes} onChange={set('notes')} className={`${fieldClass} mt-0.5`} /></label>
      </div>

      <fieldset disabled={locked} className="rounded-lg border border-border bg-background p-2.5">
        <legend className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Allocation of gross</legend>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
          <label className={L}>Gross flat fee (USD)<input inputMode="decimal" data-testid={`input-billing-amount-${id}`} value={form.amount} onChange={set('amount')} placeholder="0.00" className={`${fieldClass} mt-0.5 tabular-nums`} /></label>
          <div />
          <label className={L}>Owner<select data-testid={`select-billing-owner-${id}`} value={form.ownerId} onChange={set('ownerId')} className={`${fieldClass} mt-0.5`}><option value="">Select owner</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <div className="flex items-end gap-1.5">
            <select aria-label="Owner share type" data-testid={`select-owner-mode-${id}`} value={form.ownerMode} onChange={set('ownerMode')} className={`${fieldClass} w-[96px]`}><option value="percent">Percent</option><option value="fixed">Fixed $</option></select>
            {form.ownerMode === 'percent'
              ? <input aria-label="Owner percent" type="number" min="0" max="100" step="0.01" data-testid={`input-owner-percent-${id}`} value={form.ownerPercent} onChange={set('ownerPercent')} className={`${fieldClass} tabular-nums`} />
              : <input aria-label="Owner fixed amount" inputMode="decimal" data-testid={`input-owner-fixed-${id}`} value={form.ownerFixed} onChange={set('ownerFixed')} placeholder="0.00" className={`${fieldClass} tabular-nums`} />}
          </div>
          <label className={L}>Assignee<select data-testid={`select-billing-assignee-${id}`} value={form.assigneeId} onChange={set('assigneeId')} className={`${fieldClass} mt-0.5`}><option value="">None</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className={L}>Assignee percent<input type="number" min="0" max="100" step="0.01" disabled={locked || !form.assigneeId} data-testid={`input-assignee-percent-${id}`} value={form.assigneePercent} onChange={set('assigneePercent')} className={`${fieldClass} mt-0.5 tabular-nums`} /></label>
        </div>
        <dl className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border text-xs sm:grid-cols-4" data-testid={`summary-allocation-${id}`}>
          {([
            ['Gross', gross != null ? formatUsd(gross) : '–', ''],
            [`Owner · ${name(form.ownerId)}`, calc ? `${formatUsd(calc.ownerCents)}${form.ownerMode === 'percent' ? ` (${form.ownerPercent || 0}%)` : ' fixed'}` : '–', ''],
            [`Assignee · ${form.assigneeId ? name(form.assigneeId) : 'none'}`, calc ? `${formatUsd(calc.assigneeCents)} (${form.assigneeId ? form.assigneePercent || 0 : 0}%)` : '–', ''],
            ['Firm remainder', calc ? formatUsd(calc.firmCents) : '–', calc?.over ? 'text-rose-700' : ''],
          ] as const).map(([k, v, tone]) => <div key={k} className="bg-card px-2 py-1.5"><dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground" title={k}>{k}</dt><dd className={`font-semibold tabular-nums ${tone}`}>{v}</dd></div>)}
        </dl>
        {row.assignedToId != null && form.assigneeId !== String(row.assignedToId) && <p className="mt-1.5 text-[11px] text-muted-foreground">Task is currently assigned to {name(String(row.assignedToId))}. Billing assignee is set separately and is not changed automatically.</p>}
      </fieldset>

      {error && <p role="alert" data-testid={`status-billing-error-${id}`} className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={update.isPending || !dirty} onClick={() => void save()} data-testid={`button-save-billing-draft-${id}`} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{update.isPending ? 'Saving' : 'Save billing draft'}</button>
        {dirty && <button type="button" onClick={() => { setForm(lastServer.current); setError(null); }} data-testid={`button-discard-billing-${id}`} className="rounded-md border border-border px-2.5 py-1.5 text-xs">Discard</button>}
        {saved && !dirty && <span role="status" className="text-[11px] text-emerald-700">Draft saved. Any linked ledger entry is updated; no new charge is created.</span>}
        <span className="text-[11px] text-muted-foreground">Saving does not pre-bill.</span>
      </div>
    </div>
  );
}
