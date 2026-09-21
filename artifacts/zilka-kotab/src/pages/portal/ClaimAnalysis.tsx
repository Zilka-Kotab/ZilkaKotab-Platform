import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock3,
  GitMerge,
  History,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { SEO } from '@/components/SEO';
import {
  useClaimAnalysis,
  useCreateClaimLimitation,
  useDeleteClaimLimitation,
  useMergeClaimLimitations,
  useReorderClaimLimitations,
  useSplitClaimLimitation,
  useUpdateClaimLimitation,
  useVerifyClaimLimitations,
} from '@/lib/hooks-portal';
import type { ClaimLimitation } from '@/lib/api-portal';

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString(undefined, includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}

function actionLabel(action: string) {
  return action.charAt(0) + action.slice(1).toLowerCase();
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'blue' }) {
  const tones = {
    neutral: 'border-border bg-muted text-muted-foreground',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-sky-200 bg-sky-50 text-sky-800',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${tones[tone]}`}>{children}</span>;
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8" aria-label="Loading claim analysis">
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="h-12 w-2/3 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function ClaimAnalysis() {
  const { patentId = '', claimId = '' } = useParams();
  const { data, isLoading, error, refetch, isFetching } = useClaimAnalysis(patentId, claimId);
  const create = useCreateClaimLimitation(patentId, claimId);
  const update = useUpdateClaimLimitation(patentId, claimId);
  const remove = useDeleteClaimLimitation(patentId, claimId);
  const split = useSplitClaimLimitation(patentId, claimId);
  const merge = useMergeClaimLimitations(patentId, claimId);
  const reorder = useReorderClaimLimitations(patentId, claimId);
  const verify = useVerifyClaimLimitations(patentId, claimId);

  const [newText, setNewText] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [editing, setEditing] = useState<ClaimLimitation | null>(null);
  const [editText, setEditText] = useState('');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [splitting, setSplitting] = useState<ClaimLimitation | null>(null);
  const [splitFirst, setSplitFirst] = useState('');
  const [splitSecond, setSplitSecond] = useState('');
  const [merging, setMerging] = useState<ClaimLimitation | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const limitations = useMemo(() => data?.limitations ?? [], [data?.limitations]);
  const canEdit = Boolean(data?.permissions.canEdit);
  const canVerify = Boolean(data?.permissions.canVerify);
  const busy = create.isPending || update.isPending || remove.isPending || split.isPending || merge.isPending || reorder.isPending || verify.isPending;

  if (isLoading) return <LoadingState />;

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl p-5 lg:p-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h1 className="font-display text-xl font-semibold">Claim analysis unavailable</h1>
              <p className="mt-2 text-sm text-red-800">The claim analysis could not be loaded. No limitation changes have been made.</p>
              <button type="button" onClick={() => refetch()} disabled={isFetching} className="mt-5 inline-flex items-center gap-2 rounded-md border border-red-300 bg-red-100 px-3 py-2 text-sm font-semibold hover:bg-red-200 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const startEditing = (limitation: ClaimLimitation) => {
    setEditing(limitation);
    setEditText(limitation.limitationText);
    setEditIdentifier(limitation.identifier);
    setActionMessage(null);
  };

  const startSplitting = (limitation: ClaimLimitation) => {
    setSplitting(limitation);
    setSplitFirst(limitation.limitationText);
    setSplitSecond('');
    setActionMessage(null);
  };

  const startMerging = (limitation: ClaimLimitation) => {
    const next = limitations.find((item) => item.sequence > limitation.sequence);
    setMerging(limitation);
    setMergeTargetId(next?.publicId ?? '');
    setActionMessage(null);
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newText.trim() || !canEdit) return;
    setActionMessage(null);
    create.mutate(
      { limitationText: newText.trim(), ...(newIdentifier.trim() ? { identifier: newIdentifier.trim() } : {}) },
      {
        onSuccess: () => {
          setNewText('');
          setNewIdentifier('');
          setActionMessage('Limitation added to the working structure.');
        },
      },
    );
  };

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !editText.trim() || !canEdit) return;
    update.mutate(
      { limitationId: editing.publicId, data: { limitationText: editText.trim(), identifier: editIdentifier.trim() } },
      {
        onSuccess: () => {
          setEditing(null);
          setActionMessage('Limitation updated.');
        },
      },
    );
  };

  const handleSplit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!splitting || !splitFirst.trim() || !splitSecond.trim() || !canEdit) return;
    split.mutate(
      { limitationId: splitting.publicId, data: { firstText: splitFirst.trim(), secondText: splitSecond.trim() } },
      {
        onSuccess: () => {
          setSplitting(null);
          setActionMessage('Limitation split into two entries.');
        },
      },
    );
  };

  const handleMerge = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!merging || !mergeTargetId || !canEdit) return;
    merge.mutate(
      { limitationId: merging.publicId, withLimitationId: mergeTargetId },
      {
        onSuccess: () => {
          setMerging(null);
          setActionMessage('Limitations merged.');
        },
      },
    );
  };

  const moveLimitation = (index: number, direction: -1 | 1) => {
    if (!canEdit) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= limitations.length) return;
    const ids = limitations.map((limitation) => limitation.publicId);
    [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
    setActionMessage(null);
    reorder.mutate(ids, { onSuccess: () => setActionMessage('Limitation order saved.') });
  };

  const deleteLimitation = (limitation: ClaimLimitation) => {
    if (!canEdit) return;
    if (!window.confirm(`Delete ${limitation.identifier || `limitation ${limitation.sequence}`}? This action will be recorded in history.`)) return;
    setActionMessage(null);
    remove.mutate(limitation.publicId, { onSuccess: () => setActionMessage('Limitation deleted.') });
  };

  const mutationError = [create, update, remove, split, merge, reorder, verify].find((mutation) => mutation.error)?.error;

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO
        title={`Claim ${data.claim.claimNumber} analysis · ${data.patent.patentNumber}`}
        description="Auditable claim limitation analysis in the Zilka-Kotab secure portal."
        url={`/portal/patents/${patentId}/claims/${claimId}/analysis`}
      />
      <div className="mx-auto max-w-7xl p-5 lg:p-8">
        <Link href={`/portal/patents/${patentId}`} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to patent
        </Link>

        <header className="mb-8 flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{data.client.name} · {data.project.name}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Claim {data.claim.claimNumber}</h1>
              <Badge tone={data.structure?.state === 'VERIFIED' ? 'green' : 'amber'}>{data.structure?.state ?? 'DRAFT'}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{data.patent.patentNumber} · {data.patent.title || 'Patent title unavailable'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={canEdit ? 'blue' : 'neutral'}>{canEdit ? 'Attorney workspace' : 'Read only'}</Badge>
            {canVerify && (
              <button
                type="button"
                disabled={busy || !limitations.length}
                onClick={() => {
                  setActionMessage(null);
                  verify.mutate(undefined, { onSuccess: () => setActionMessage('All limitations marked verified.') });
                }}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" /> Verify structure
              </button>
            )}
          </div>
        </header>

        {!canEdit && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>This view is read-only. Client access receives only limitations verified by the server.</p>
          </div>
        )}
        {actionMessage && <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900" role="status">{actionMessage}</div>}
        {mutationError && <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert"><AlertTriangle className="h-4 w-4 shrink-0" /> {mutationError instanceof Error ? mutationError.message : 'The change could not be saved.'}</div>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="authoritative-claim-heading">
            <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/40 p-5 sm:p-6">
              <div>
                <div className="flex items-center gap-2 text-primary"><LockKeyhole className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-[0.16em]">Authoritative source</p></div>
                <h2 id="authoritative-claim-heading" className="mt-2 font-display text-xl font-semibold">Claim text</h2>
              </div>
              <Badge>Immutable</Badge>
            </div>
            <div className="p-5 sm:p-7">
              <p className="whitespace-pre-wrap font-serif text-[1.04rem] leading-8 text-foreground">{data.claim.claimText}</p>
              <div className="mt-7 grid gap-4 border-t border-border pt-5 text-xs sm:grid-cols-3">
                <div><p className="uppercase tracking-[0.12em] text-muted-foreground">Version</p><p className="mt-1 font-semibold text-foreground">v{data.claim.version}</p></div>
                <div><p className="uppercase tracking-[0.12em] text-muted-foreground">Source</p><p className="mt-1 font-semibold text-foreground">{data.claim.source}</p></div>
                <div><p className="uppercase tracking-[0.12em] text-muted-foreground">Claim status</p><p className="mt-1 font-semibold text-foreground">{data.claim.verificationStatus}</p></div>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="structure-state-heading">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" /><h2 id="structure-state-heading" className="font-display text-lg font-semibold">Structure record</h2></div>
              <dl className="mt-5 space-y-4 text-sm">
                <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Current state</dt><dd className="mt-1"><Badge tone={data.structure?.state === 'VERIFIED' ? 'green' : 'amber'}>{data.structure?.state ?? 'DRAFT'}</Badge></dd></div>
                <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Created</dt><dd className="mt-1 text-foreground">{formatDate(data.structure?.createdAt)}</dd></div>
                <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Last changed</dt><dd className="mt-1 text-foreground">{formatDate(data.structure?.updatedAt, true)}</dd></div>
                <div><dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Verified by</dt><dd className="mt-1 text-foreground">{data.structure?.verifiedBy?.name ?? 'Not verified'}</dd></div>
              </dl>
            </section>
            <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-5" aria-labelledby="ai-status-heading">
              <div className="flex items-center gap-2 text-amber-900"><Sparkles className="h-4 w-4" /><h2 id="ai-status-heading" className="font-display text-lg font-semibold">Generate limitations</h2></div>
              <p className="mt-2 text-sm leading-6 text-amber-900/80">AI processing not configured{data.ai.message && data.ai.message !== 'AI processing not configured' ? ` · ${data.ai.message}` : ''}</p>
              <button type="button" disabled title="AI processing not configured" className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 opacity-70">
                <Sparkles className="h-4 w-4" /> Generate Limitations
              </button>
              <p className="mt-3 text-xs text-amber-900/70">No limitations are generated automatically. Add and review each entry manually.</p>
            </section>
          </aside>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="limitations-heading">
          <div className="flex flex-col gap-4 border-b border-border p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">01</div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Working structure</p></div>
              <h2 id="limitations-heading" className="mt-3 font-display text-2xl font-semibold">Claim limitations</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Edit the auditable limitation structure below. The source claim above remains unchanged.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{limitations.length}</span> {limitations.length === 1 ? 'limitation' : 'limitations'}</div>
          </div>

          {limitations.length ? (
            <div className="divide-y divide-border">
              {limitations.map((limitation, index) => (
                <article key={limitation.publicId} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-2 sm:w-28 sm:shrink-0">
                      <span className="font-mono text-sm font-bold text-primary">{limitation.identifier || `L${String(index + 1).padStart(2, '0')}`}</span>
                      <span className="text-xs text-muted-foreground">#{limitation.sequence}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-foreground">{limitation.limitationText}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge tone={limitation.verificationStatus === 'VERIFIED' ? 'green' : 'amber'}>{limitation.verificationStatus}</Badge>
                        <Badge tone={limitation.creationMethod === 'AI_GENERATED' ? 'blue' : 'neutral'}>{limitation.creationMethod === 'AI_GENERATED' ? 'AI generated' : 'Manual'}</Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Updated {formatDate(limitation.updatedAt)}</span>
                        {limitation.verifiedById && <span className="inline-flex items-center gap-1 text-xs text-emerald-800"><Check className="h-3.5 w-3.5" /> Verified record</span>}
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-1 sm:justify-end" aria-label={`Actions for ${limitation.identifier || `limitation ${limitation.sequence}`}`}>
                        <button type="button" onClick={() => moveLimitation(index, -1)} disabled={busy || index === 0} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30" aria-label="Move limitation up"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" onClick={() => moveLimitation(index, 1)} disabled={busy || index === limitations.length - 1} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30" aria-label="Move limitation down"><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" onClick={() => startEditing(limitation)} disabled={busy} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Edit limitation"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => startSplitting(limitation)} disabled={busy} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Split limitation"><Scissors className="h-4 w-4" /></button>
                        <button type="button" onClick={() => startMerging(limitation)} disabled={busy || limitations.length < 2} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Merge limitation"><GitMerge className="h-4 w-4" /></button>
                        <button type="button" onClick={() => deleteLimitation(limitation)} disabled={busy} className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50" aria-label="Delete limitation"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary"><Plus className="h-5 w-5" /></div>
              <h3 className="mt-4 font-display text-lg font-semibold">No limitations recorded</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{canEdit ? 'Begin a careful manual structure below. Nothing will be inferred or generated without a configured provider.' : 'Verified limitations will appear here when they are available to your account.'}</p>
            </div>
          )}

          {canEdit && (
            <form onSubmit={handleCreate} className="border-t border-border bg-muted/20 p-5 sm:p-6">
              <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Add limitation</h3></div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[140px_minmax(0,1fr)_auto]">
                <label className="text-sm font-medium">Identifier<input value={newIdentifier} onChange={(event) => setNewIdentifier(event.target.value)} placeholder="L01" className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none ring-primary transition focus:ring-2" /></label>
                <label className="text-sm font-medium">Limitation text<span className="sr-only"> required</span><textarea required value={newText} onChange={(event) => setNewText(event.target.value)} placeholder="Describe one claim limitation…" rows={3} className="mt-1.5 w-full resize-y rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-6 outline-none ring-primary transition focus:ring-2" /></label>
                <button type="submit" disabled={busy || !newText.trim()} className="inline-flex h-fit items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:self-end"><Plus className="h-4 w-4" /> Add</button>
              </div>
            </form>
          )}
        </section>

        {editing && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="edit-limitation-title">
            <form onSubmit={handleUpdate} className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><h2 id="edit-limitation-title" className="font-display text-xl font-semibold">Edit limitation</h2><p className="mt-1 text-sm text-muted-foreground">The change will be recorded in the analysis history.</p></div><button type="button" onClick={() => setEditing(null)} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Close edit form"><X className="h-5 w-5" /></button></div>
              <div className="mt-5 space-y-4"><label className="block text-sm font-medium">Identifier<input value={editIdentifier} onChange={(event) => setEditIdentifier(event.target.value)} className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" /></label><label className="block text-sm font-medium">Limitation text<textarea required value={editText} onChange={(event) => setEditText(event.target.value)} rows={5} className="mt-1.5 w-full resize-y rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-6 outline-none ring-primary focus:ring-2" /></label></div>
              <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button><button type="submit" disabled={update.isPending || !editText.trim()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> Save changes</button></div>
            </form>
          </div>
        )}

        {splitting && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="split-limitation-title">
            <form onSubmit={handleSplit} className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><h2 id="split-limitation-title" className="font-display text-xl font-semibold">Split limitation</h2><p className="mt-1 text-sm text-muted-foreground">Create two ordered entries from this limitation.</p></div><button type="button" onClick={() => setSplitting(null)} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Close split form"><X className="h-5 w-5" /></button></div>
              <div className="mt-5 space-y-4"><label className="block text-sm font-medium">First limitation<textarea required value={splitFirst} onChange={(event) => setSplitFirst(event.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-6 outline-none ring-primary focus:ring-2" /></label><label className="block text-sm font-medium">Second limitation<textarea required value={splitSecond} onChange={(event) => setSplitSecond(event.target.value)} rows={3} className="mt-1.5 w-full resize-y rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-6 outline-none ring-primary focus:ring-2" /></label></div>
              <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSplitting(null)} className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button><button type="submit" disabled={split.isPending || !splitFirst.trim() || !splitSecond.trim()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Scissors className="h-4 w-4" /> Split limitation</button></div>
            </form>
          </div>
        )}

        {merging && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="merge-limitation-title">
            <form onSubmit={handleMerge} className="w-full max-w-xl rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><h2 id="merge-limitation-title" className="font-display text-xl font-semibold">Merge limitations</h2><p className="mt-1 text-sm text-muted-foreground">Choose the second entry to merge with {merging.identifier || `limitation ${merging.sequence}`}.</p></div><button type="button" onClick={() => setMerging(null)} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Close merge form"><X className="h-5 w-5" /></button></div>
              <label className="mt-5 block text-sm font-medium">Merge with<select required value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)} className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"><option value="">Select a limitation</option>{limitations.filter((limitation) => limitation.publicId !== merging.publicId).map((limitation) => <option key={limitation.publicId} value={limitation.publicId}>{limitation.identifier || `Limitation ${limitation.sequence}`} · {limitation.limitationText.slice(0, 72)}</option>)}</select></label>
              <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setMerging(null)} className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">Cancel</button><button type="submit" disabled={merge.isPending || !mergeTargetId} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> Merge limitations</button></div>
            </form>
          </div>
        )}

        {data.permissions.canViewHistory && (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="history-heading">
            <div className="flex items-center gap-2"><History className="h-5 w-5 text-primary" /><h2 id="history-heading" className="font-display text-xl font-semibold">Analysis history</h2><span className="text-sm text-muted-foreground">Auditable record</span></div>
            {data.history.length ? (
              <ol className="mt-5 divide-y divide-border">
                {data.history.map((entry) => <li key={entry.publicId} className="grid gap-2 py-4 text-sm sm:grid-cols-[130px_minmax(0,1fr)_170px] sm:items-center"><div><Badge tone={entry.action === 'VERIFIED' ? 'green' : 'neutral'}>{actionLabel(entry.action)}</Badge></div><p className="text-muted-foreground">{entry.identifier ? <span className="font-medium text-foreground">{entry.identifier} · </span> : null}{entry.limitationText || 'Structure record changed.'}</p><time className="text-xs text-muted-foreground sm:text-right" dateTime={entry.createdAt}>{formatDate(entry.createdAt, true)}{entry.actor?.name ? ` · ${entry.actor.name}` : ''}</time></li>)}
              </ol>
            ) : <p className="mt-5 rounded-lg bg-muted/40 p-5 text-sm text-muted-foreground">No changes have been recorded yet.</p>}
          </section>
        )}
      </div>
    </div>
  );
}