import { FormEvent, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, BrainCircuit, FileSearch, Loader2, LockKeyhole, Plus, Scale } from 'lucide-react';
import { SEO } from '@/components/SEO';
import {
  useCreateManualAnalysis,
  useCreatePatent,
  useCreateWorkspaceItem,
  usePortalAccess,
  useProjectWorkspace,
} from '@/lib/hooks-portal';
import type { AnalysisTriage, DataClassification } from '@/lib/api-portal';

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
  const projectId = Number(useParams().projectId ?? 0);
  const { data, isLoading, error } = useProjectWorkspace(projectId);
  const { data: access } = usePortalAccess();
  const createItem = useCreateWorkspaceItem(projectId);
  const createRun = useCreateManualAnalysis(projectId);
  const createPatent = useCreatePatent(projectId);
  const [item, setItem] = useState({ title: '', itemType: 'PUBLIC_EVIDENCE', content: '', classification: 'PUBLIC_SOURCE' as DataClassification });
  const [analysis, setAnalysis] = useState({ summary: '', triage: 'MEDIUM' as AnalysisTriage });
  const [patent, setPatent] = useState({ patentNumber: '', title: '', jurisdiction: 'US' });

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
    createPatent.mutate(patent, { onSuccess: () => setPatent({ patentNumber: '', title: '', jurisdiction: 'US' }) });
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
            {data.patents.map((entry) => <div key={entry.id} className="p-5"><div className="flex justify-between gap-4"><div><p className="font-semibold">{entry.patentNumber}</p><p className="text-sm text-muted-foreground">{entry.title}</p></div><span className="text-xs text-muted-foreground">{entry.jurisdiction}</span></div><p className="mt-3 text-xs font-medium text-muted-foreground">{entry.claims.length} claim version{entry.claims.length === 1 ? '' : 's'}</p></div>)}
            {!data.patents.length && <p className="p-8 text-center text-sm text-muted-foreground">No patents are being monitored yet.</p>}
          </div>
          <form onSubmit={submitPatent} className="grid gap-3 border-t border-border bg-muted/20 p-5 md:grid-cols-3">
            <input required value={patent.patentNumber} onChange={(e) => setPatent({ ...patent, patentNumber: e.target.value })} placeholder="Patent number" className="rounded-md border border-input bg-white px-3 py-2 text-sm" />
            <input required value={patent.title} onChange={(e) => setPatent({ ...patent, title: e.target.value })} placeholder="Patent title" className="rounded-md border border-input bg-white px-3 py-2 text-sm" />
            <button disabled={createPatent.isPending} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Add patent</button>
          </form>
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
            {data.workspaceItems.map((record) => <article key={record.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{record.title}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{classificationLabels[record.classification]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{record.content}</p></article>)}
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
            {data.analysisRuns.map((run) => <article key={run.id} className="p-5"><div className="flex items-center justify-between gap-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${run.triage === 'HIGH' ? 'bg-red-100 text-red-800' : run.triage === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{run.triage}</span><span className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleDateString()}</span></div><p className="mt-3 text-sm">{run.summary}</p><p className="mt-2 text-xs text-muted-foreground">{run.provider} · {run.reviews.at(-1)?.status ?? run.reviewStatus}</p></article>)}
            {!data.analysisRuns.length && <p className="p-8 text-center text-sm text-muted-foreground">No analysis runs have been recorded.</p>}
          </div>
          {data.aiConfig.selectedProvider === 'MANUAL' && <form onSubmit={submitAnalysis} className="space-y-3 border-t border-border bg-muted/20 p-5"><select value={analysis.triage} onChange={(e) => setAnalysis({ ...analysis, triage: e.target.value as AnalysisTriage })} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select><textarea required value={analysis.summary} onChange={(e) => setAnalysis({ ...analysis, summary: e.target.value })} placeholder="Manual limitation-analysis summary" className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm" /><button disabled={createRun.isPending} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Record immutable analysis</button></form>}
        </section>
      </div>
    </div>
  );
}