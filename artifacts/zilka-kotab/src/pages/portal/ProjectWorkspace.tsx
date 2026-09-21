import { FormEvent, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, BrainCircuit, Check, ChevronDown, FileSearch, Loader2, LockKeyhole, RefreshCw, Scale, ShieldAlert } from 'lucide-react';
import { SEO } from '@/components/SEO';
import {
  useCreateManualAnalysis,
  useCreatePatent,
  useCreateWorkspaceItem,
  usePreviewPatentImport,
  useCommitPatentImport,
  usePortalAccess,
  useProjectWorkspace,
} from '@/lib/hooks-portal';
import type { AnalysisTriage, DataClassification, PatentImportDraft } from '@/lib/api-portal';

const providerLabels = {
  CLIENT_MICROSOFT: 'Client Microsoft Environment',
  ZK_MANAGED_AI: 'Zilka-Kotab Managed AI',
  MANUAL: 'Manual / No AI',
};
const classificationLabels = {
  PUBLIC_SOURCE: 'Public source',
  CLIENT_CONFIDENTIAL: 'Client confidential',
  ATTORNEY_WORK_PRODUCT: 'Attorney work product',
};

export default function ProjectWorkspace() {
  const projectId = useParams().projectId ?? '';
  const { data, isLoading, error } = useProjectWorkspace(projectId);
  const { data: access } = usePortalAccess();
  const createItem = useCreateWorkspaceItem(projectId);
  const createRun = useCreateManualAnalysis(projectId);
  const createPatent = useCreatePatent(projectId);
  const previewPatent = usePreviewPatentImport(projectId);
  const commitPatent = useCommitPatentImport(projectId);
  const [item, setItem] = useState({ title: '', itemType: 'PUBLIC_EVIDENCE', content: '', classification: 'PUBLIC_SOURCE' as DataClassification });
  const [analysis, setAnalysis] = useState({ summary: '', triage: 'MEDIUM' as AnalysisTriage });
  const [patentNumbers, setPatentNumbers] = useState('');
  const [drafts, setDrafts] = useState<PatentImportDraft[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<Record<string, string[]>>({});
  const [manualDraft, setManualDraft] = useState<PatentImportDraft | null>(null);
  const [manual, setManual] = useState({ title: '', claimNumber: '1', claimText: '' });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !data) return <div className="p-8"><div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">The project workspace could not be loaded.</div></div>;

  const canCreateWorkProduct = access?.user?.role !== 'CLIENT';
  const submitItem = (event: FormEvent) => {
    event.preventDefault();
    createItem.mutate(item, { onSuccess: () => setItem({ ...item, title: '', content: '' }) });
  };
  const submitAnalysis = (event: FormEvent) => {
    event.preventDefault();
    createRun.mutate(analysis, { onSuccess: () => setAnalysis({ ...analysis, summary: '' }) });
  };
  const submitPatent = (event: FormEvent) => {
    event.preventDefault();
    previewPatent.mutate(patentNumbers, {
      onSuccess: ({ drafts: nextDrafts }) => {
        setDrafts(nextDrafts);
        setPatentNumbers('');
        setSelectedClaims(Object.fromEntries(nextDrafts.map((draft) => [
          draft.publicId,
          draft.patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT' && claim.selectedForMonitoring).map((claim) => claim.claimNumber),
        ])));
      },
    });
  };
  const commitDraft = (draft: PatentImportDraft) => {
    commitPatent.mutate(
      { draftId: draft.publicId, selectedClaimNumbers: selectedClaims[draft.publicId] ?? [] },
      { onSuccess: () => setDrafts((current) => current.filter((item) => item.publicId !== draft.publicId)) },
    );
  };
  const submitManual = (event: FormEvent) => {
    event.preventDefault();
    if (!manualDraft) return;
    createPatent.mutate({
      patentNumber: manualDraft.normalizedPatentNumber,
      title: manual.title,
      jurisdiction: 'US',
      claims: manual.claimText ? [{ claimNumber: manual.claimNumber, claimText: manual.claimText, claimType: 'UNKNOWN', selectedForMonitoring: false }] : [],
    }, {
      onSuccess: () => {
        setDrafts((current) => current.filter((item) => item.publicId !== manualDraft.publicId));
        setManualDraft(null);
        setManual({ title: '', claimNumber: '1', claimText: '' });
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <SEO title={data.project.name} description={`${data.tool.name} project workspace`} url={`/portal/projects/${projectId}`} />
      <Link href="/portal" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to portal</Link>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{data.tool.name}</p>
          <h1 className="font-display text-3xl font-bold text-foreground">{data.project.name}</h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">{data.client.name}</p>
            <p className="mt-2 max-w-3xl text-muted-foreground">{data.project.description || 'Secure project workspace and analysis history.'}</p>
        </div>
        <div className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Processing environment</p>
          <p className="mt-1 font-semibold text-foreground">{providerLabels[data.aiConfig.selectedProvider]}</p>
          {data.aiConfig.selectedProvider !== 'MANUAL' && <p className="mt-1 text-xs text-amber-700">Connection not enabled. No project data will be transferred.</p>}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-5"><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /><h2 className="font-semibold">Monitored patents</h2></div><span className="text-sm text-muted-foreground">{data.patents.length}</span></div>
          <div className="divide-y divide-border">
            {data.patents.map((entry) => <Link href={`/portal/patents/${entry.publicId}`} key={entry.publicId} className="block p-5 transition hover:bg-muted/20"><div className="flex justify-between gap-4"><div><p className="font-semibold">{entry.patentNumber}</p><p className="text-sm text-muted-foreground">{entry.title}</p></div><span className={`text-xs font-medium ${entry.monitoringActive ? 'text-green-700' : 'text-amber-700'}`}>{entry.monitoringActive ? 'Active' : 'Paused'}</span></div><p className="mt-3 text-xs font-medium text-muted-foreground">{entry.claims.length} claim{entry.claims.length === 1 ? '' : 's'} · {entry.claims.filter((claim) => claim.claimType === 'INDEPENDENT').length} independent</p></Link>)}
            {!data.patents.length && <p className="p-8 text-center text-sm text-muted-foreground">No patents are being monitored yet.</p>}
          </div>
          <form onSubmit={submitPatent} className="space-y-3 border-t border-border bg-muted/20 p-5">
            <div><label className="text-sm font-medium">Add patent</label><p className="mt-1 text-xs text-muted-foreground">Enter one or more U.S. patent numbers. Titles and claims will be retrieved for your review before anything is added.</p></div>
            <div className="flex flex-col gap-3 md:flex-row"><textarea required value={patentNumbers} onChange={(e) => setPatentNumbers(e.target.value)} placeholder="US 12,345,678 B2&#10;12345679" className="min-h-20 flex-1 rounded-md border border-input bg-white px-3 py-2 text-sm" /><button disabled={previewPatent.isPending} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${previewPatent.isPending ? 'animate-spin' : ''}`} /> Retrieve for review</button></div>
            {previewPatent.error && <p className="text-sm text-red-700">{previewPatent.error instanceof Error ? previewPatent.error.message : 'Patent retrieval failed.'}</p>}
          </form>
          {drafts.length > 0 && <div className="border-t border-border">
            <div className="bg-primary/5 px-5 py-4"><h3 className="font-semibold">Review retrieved patents</h3><p className="mt-1 text-sm text-muted-foreground">Confirm the bibliographic information and select the independent claims to monitor.</p></div>
            {drafts.map((draft) => {
              const selected = selectedClaims[draft.publicId] ?? [];
              const independent = draft.patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT');
              const dependent = draft.patent.claims.filter((claim) => claim.claimType !== 'INDEPENDENT');
              return <article key={draft.publicId} className="space-y-4 border-t border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{draft.normalizedPatentNumber}</p><p className="text-sm text-muted-foreground">{draft.patent.title || 'Title unavailable'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${draft.status === 'READY' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{draft.status === 'READY' ? 'Ready for review' : 'Incomplete retrieval'}</span></div>
                {draft.status === 'READY' ? <><div className="grid gap-3 text-sm md:grid-cols-3"><div><span className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</span><p className="mt-1">{draft.patent.assignee || 'Not provided'}</p></div><div><span className="text-xs uppercase tracking-wide text-muted-foreground">Issue date</span><p className="mt-1">{draft.patent.issueDate || 'Not provided'}</p></div><div><span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span><p className="mt-1">{draft.patent.patentStatus}</p></div></div><div><h4 className="mb-2 text-sm font-semibold">Independent claims</h4><div className="space-y-2">{independent.map((claim) => <label key={claim.claimNumber} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 hover:bg-muted/20"><input type="checkbox" checked={selected.includes(claim.claimNumber)} onChange={(event) => setSelectedClaims((current) => ({ ...current, [draft.publicId]: event.target.checked ? [...selected, claim.claimNumber] : selected.filter((number) => number !== claim.claimNumber) }))} className="mt-1" /><span><span className="font-medium">Claim {claim.claimNumber}</span><span className="mt-1 block text-sm text-muted-foreground">{claim.claimText}</span></span></label>)}</div></div>{dependent.length > 0 && <details><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><ChevronDown className="h-4 w-4" /> Dependent claims ({dependent.length})</summary><div className="mt-2 space-y-2 pl-6">{dependent.map((claim) => <div key={claim.claimNumber} className="rounded-lg bg-muted/30 p-3 text-sm"><span className="font-medium">Claim {claim.claimNumber}</span>{claim.dependsOnClaimNumber && <span className="ml-2 text-xs text-muted-foreground">depends on claim {claim.dependsOnClaimNumber}</span>}<p className="mt-1 text-muted-foreground">{claim.claimText}</p></div>)}</div></details>}<button type="button" disabled={commitPatent.isPending} onClick={() => commitDraft(draft)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Check className="h-4 w-4" /> Add to project</button>{commitPatent.error && <p className="text-sm text-red-700">{commitPatent.error instanceof Error ? commitPatent.error.message : 'The patent could not be added.'}</p>}</> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2 text-sm text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">The USPTO response was incomplete.</p><ul className="mt-1 list-disc pl-5">{draft.errors.map((message) => <li key={message}>{message}</li>)}</ul><p className="mt-2">No incomplete data was added automatically.</p></div></div>{canCreateWorkProduct && (manualDraft?.publicId === draft.publicId ? <form onSubmit={submitManual} className="mt-4 space-y-2 border-t border-amber-200 pt-4"><input required value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} placeholder="Corrected patent title" className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm" /><div className="grid gap-2 md:grid-cols-3"><input value={manual.claimNumber} onChange={(e) => setManual({ ...manual, claimNumber: e.target.value })} placeholder="Claim number" className="rounded-md border border-input bg-white px-3 py-2 text-sm" /><input value={manual.claimText} onChange={(e) => setManual({ ...manual, claimText: e.target.value })} placeholder="Optional corrected claim text" className="rounded-md border border-input bg-white px-3 py-2 text-sm md:col-span-2" /></div><div className="flex gap-2"><button disabled={createPatent.isPending} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Save manual correction</button><button type="button" onClick={() => setManualDraft(null)} className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button></div>{createPatent.error && <p className="text-sm text-red-700">{createPatent.error instanceof Error ? createPatent.error.message : 'Manual correction failed.'}</p>}</form> : <button type="button" onClick={() => setManualDraft(draft)} className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900">Enter manual correction</button>)}</div>}
              </article>;
            })}
          </div>}
        </section>

        <section className="rounded-2xl border border-border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-border p-5"><LockKeyhole className="h-5 w-5 text-primary" /><h2 className="font-semibold">Data boundary</h2></div>
          <div className="space-y-3 p-5 text-sm text-muted-foreground">
            <p>Only information intentionally added to this project is stored here.</p>
            <p>Confidential and attorney-work-product records are classified separately from public sources.</p>
            <p>No Microsoft 365, Copilot, SharePoint, OneDrive, email, or Teams content is connected.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-5"><div className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-primary" /><h2 className="font-semibold">Project evidence and records</h2></div><span className="text-sm text-muted-foreground">{data.workspaceItems.length}</span></div>
          <div className="divide-y divide-border">
            {data.workspaceItems.map((record) => <article key={record.publicId} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{record.title}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{classificationLabels[record.classification]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{record.content}</p></article>)}
            {!data.workspaceItems.length && <p className="p-8 text-center text-sm text-muted-foreground">No evidence or project records have been added.</p>}
          </div>
          <form onSubmit={submitItem} className="space-y-3 border-t border-border bg-muted/20 p-5">
            <div className="grid gap-3 md:grid-cols-2"><input required value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} placeholder="Record title" className="rounded-md border border-input bg-white px-3 py-2 text-sm" /><select value={item.classification} onChange={(e) => setItem({ ...item, classification: e.target.value as DataClassification })} className="rounded-md border border-input bg-white px-3 py-2 text-sm"><option value="PUBLIC_SOURCE">Public source</option><option value="CLIENT_CONFIDENTIAL">Client confidential</option>{canCreateWorkProduct && <option value="ATTORNEY_WORK_PRODUCT">Attorney work product</option>}</select></div>
            <textarea required value={item.content} onChange={(e) => setItem({ ...item, content: e.target.value })} placeholder="Record content or source notes" className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" />
            <button disabled={createItem.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Add classified record</button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-border p-5"><BrainCircuit className="h-5 w-5 text-primary" /><h2 className="font-semibold">Analysis history</h2></div>
          <div className="divide-y divide-border">
            {data.analysisRuns.map((run) => <article key={run.publicId} className="p-5"><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${run.triage === 'HIGH' ? 'bg-red-100 text-red-800' : run.triage === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{run.triage}</span><span className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleDateString()}</span></div><p className="mt-3 text-sm">{run.summary}</p><p className="mt-2 text-xs text-muted-foreground">{run.provider} · {run.reviews.at(-1)?.status ?? run.reviewStatus}</p></article>)}
            {!data.analysisRuns.length && <p className="p-8 text-center text-sm text-muted-foreground">No analysis runs have been recorded.</p>}
          </div>
          {data.aiConfig.selectedProvider === 'MANUAL' && <form onSubmit={submitAnalysis} className="space-y-3 border-t border-border bg-muted/20 p-5"><select value={analysis.triage} onChange={(e) => setAnalysis({ ...analysis, triage: e.target.value as AnalysisTriage })} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select><textarea required value={analysis.summary} onChange={(e) => setAnalysis({ ...analysis, summary: e.target.value })} placeholder="Manual limitation-analysis summary" className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" /><button disabled={createRun.isPending} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Record immutable analysis</button></form>}
        </section>
      </div>
    </div>
  );
}