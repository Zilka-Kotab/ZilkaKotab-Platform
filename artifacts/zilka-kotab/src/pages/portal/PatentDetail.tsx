import { useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  SearchCheck,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { SEO } from '@/components/SEO';
import { usePatent, usePortalAccess, useRefreshPatent, useUpdatePatentArchive, useUpdatePatentMonitoring } from '@/lib/hooks-portal';

type DetailSection = 'overview' | 'claims' | 'findings' | 'evidence' | 'history' | 'settings';

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt><dd className="mt-1.5 break-words text-sm font-medium text-foreground">{value}</dd></div>;
}

function evidenceText(value: unknown) {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

const sectionItems: Array<{ id: DetailSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'claims', label: 'Claims', icon: FileText },
  { id: 'findings', label: 'Findings', icon: SearchCheck },
  { id: 'evidence', label: 'Evidence', icon: BookOpen },
  { id: 'history', label: 'Analysis history', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export default function PatentDetail() {
  const patentId = useParams().patentId ?? '';
  const { data, isLoading, error } = usePatent(patentId);
  const { data: access } = usePortalAccess();
  const refresh = useRefreshPatent(patentId);
  const monitoring = useUpdatePatentMonitoring(patentId);
  const archive = useUpdatePatentArchive(patentId);
  const [archivePrompt, setArchivePrompt] = useState(false);
  const [activeSection, setActiveSection] = useState<DetailSection>('overview');

  if (isLoading) {
    return <div className="mx-auto max-w-7xl p-6 lg:p-8"><div className="animate-pulse space-y-5"><div className="h-5 w-32 rounded bg-muted" /><div className="h-12 w-2/3 rounded bg-muted" /><div className="h-12 rounded-2xl bg-muted" /><div className="grid gap-5 lg:grid-cols-3"><div className="h-64 rounded-2xl bg-muted lg:col-span-2" /><div className="h-64 rounded-2xl bg-muted" /></div><div className="h-96 rounded-2xl bg-muted" /></div></div>;
  }
  if (error || !data) {
    return <div className="mx-auto max-w-3xl p-6 lg:p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"><p className="font-semibold">The patent could not be loaded.</p><p className="mt-1 text-red-700">The record may no longer be available to this workspace.</p><Link href="/portal" className="mt-4 inline-flex rounded-lg bg-red-800 px-3 py-2 font-semibold text-white">Back to portal</Link></div></div>;
  }

  const { patent } = data;
  const independentClaims = patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT');
  const dependentClaims = patent.claims.filter((claim) => claim.claimType !== 'INDEPENDENT');
  const patentRuns = data.analysisRuns.filter((run) => run.patentId === patent.publicId);
  const evidenceEntries = patentRuns.flatMap((run) => run.evidence.map((item, index) => ({ item, index, run })));
  const lastAnalyzedAt = patent.lastAnalyzedAt || patentRuns[0]?.createdAt;
  const canArchive = access?.user?.role === 'ADMIN' || access?.user?.role === 'ATTORNEY';
  const canManageMonitoring = access?.user?.role === 'ADMIN' || access?.user?.role === 'ATTORNEY';
  const isArchived = Boolean(patent.archivedAt);

  const confirmArchive = () => {
    archive.mutate(!isArchived, { onSuccess: () => setArchivePrompt(false) });
  };

  const renderOverview = () => <div className="grid gap-5 lg:grid-cols-3">
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)] sm:p-6 lg:col-span-2">
      <div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span><div><h2 className="font-display text-lg font-semibold">Patent record</h2><p className="text-xs text-muted-foreground">Bibliographic and source information stored in this workspace.</p></div></div>
      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        <DetailField label="Patent status" value={patent.patentStatus || 'Not recorded'} />
        <DetailField label="Source status" value={patent.sourceStatus || 'Not recorded'} />
        <DetailField label="Jurisdiction" value={patent.jurisdiction || 'Not recorded'} />
        <DetailField label="Current assignee" value={patent.assignee || 'Not provided'} />
        <DetailField label="Application number" value={patent.applicationNumber || 'Not provided'} />
        <DetailField label="Filing date" value={formatDate(patent.filingDate)} />
        <DetailField label="Earliest priority" value={formatDate(patent.earliestPriorityDate)} />
        <DetailField label="Issue date" value={formatDate(patent.issueDate)} />
        <DetailField label="Inventors" value={patent.inventors.length ? patent.inventors.join(', ') : 'Not provided'} />
      </dl>
      <div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
        <DetailField label="Record source" value={patent.source || 'Not recorded'} />
        <DetailField label="Retrieval method" value={patent.retrievalMethod || 'Not recorded'} />
        <DetailField label="Source identifier" value={patent.sourceIdentifier || 'Not provided'} />
        <DetailField label="Verification status" value={patent.verificationStatus} />
      </div>
      {patent.abstract && <div className="mt-6 border-t border-border pt-5"><h3 className="text-sm font-semibold">Abstract</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{patent.abstract}</p></div>}
      {patent.sourceUrl && <a href={patent.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Open source record <ExternalLink className="h-3.5 w-3.5" /></a>}
    </section>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)] sm:p-6">
      <div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="font-display text-lg font-semibold">Monitoring</h2><p className="text-xs text-muted-foreground">Current record state only.</p></div></div>
      <div className={`rounded-xl border p-4 ${isArchived ? 'border-slate-200 bg-slate-50' : patent.monitoringActive ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}><p className="text-sm font-semibold">{isArchived ? 'Record archived' : patent.monitoringActive ? 'Monitoring is active' : 'Monitoring is paused'}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{isArchived ? `Archived ${formatDate(patent.archivedAt)}.` : patent.monitoringActive ? 'This patent is included in the project monitoring set.' : 'This patent remains in the project but is not actively monitored.'}</p></div>
       <dl className="mt-5 space-y-4"><DetailField label="Last analyzed" value={formatDateTime(lastAnalyzedAt)} /><DetailField label="Retrieved" value={formatDateTime(patent.retrievedAt)} /><DetailField label="Stored claims" value={`${patent.claims.length} total · ${independentClaims.length} independent`} /></dl>
      <div className="mt-6 border-t border-border pt-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Versioning</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Source refreshes preserve prior claim versions for review and comparison.</p></div>
    </section>
  </div>;

  const renderClaims = () => <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)]">
    <div className="border-b border-border px-5 py-5 sm:px-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Claims</h2><p className="mt-1 text-xs text-muted-foreground">{independentClaims.length} independent · {dependentClaims.length} dependent or unclassified</p></div><span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"><History className="h-3.5 w-3.5" /> Full text preserved</span></div></div>
    <div className="divide-y divide-border">
      {independentClaims.map((claim) => <article key={claim.publicId} className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-xs font-bold text-muted-foreground">{claim.claimNumber}</span><span className="text-sm font-semibold">Independent claim {claim.claimNumber}</span>{claim.selectedForMonitoring && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Monitoring</span>}</div>{claim.selectedForMonitoring && <Link href={`/portal/patents/${patentId}/claims/${claim.publicId}/analysis`} className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Open limitation analysis</Link>}</div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{claim.claimText}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span>Version {claim.version}</span><span>Source {claim.source}</span><span>Verified {claim.verificationStatus}</span></div></article>)}
      {dependentClaims.length > 0 && <details className="group p-5 sm:p-6"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /> Dependent and other claims</span><span className="text-xs font-medium text-muted-foreground">{dependentClaims.length} claims</span></summary><div className="mt-4 space-y-4">{dependentClaims.map((claim) => <article key={claim.publicId} className="rounded-xl border border-border bg-muted/25 p-4"><div className="flex flex-wrap items-center gap-2 text-sm font-semibold">Claim {claim.claimNumber}{claim.dependsOnClaimNumber && <span className="text-xs font-normal text-muted-foreground">depends on claim {claim.dependsOnClaimNumber}</span>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{claim.claimText}</p><p className="mt-3 text-[11px] text-muted-foreground">Version {claim.version} · {claim.verificationStatus}</p></article>)}</div></details>}
      {!patent.claims.length && <div className="px-6 py-14 text-center"><FileText className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold">No claims are stored for this patent.</p><p className="mt-1 text-sm text-muted-foreground">The source record did not provide claims for this version.</p></div>}
    </div>
  </section>;

  const renderFindings = () => <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)] sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-semibold">Findings</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Recorded summaries and triage from this patent&apos;s analysis runs. These records are not legal conclusions.</p></div><ListChecks className="h-5 w-5 shrink-0 text-primary" /></div>
    {patentRuns.length ? <div className="mt-5 space-y-3">{patentRuns.map((run) => <article key={run.publicId} className="rounded-xl border border-border bg-muted/25 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${run.triage === 'HIGH' ? 'bg-red-50 text-red-700' : run.triage === 'MEDIUM' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{run.triage}</span><span className="rounded-full bg-card px-2 py-1 text-[10px] font-bold text-muted-foreground">{run.reviewStatus}</span></div><span className="text-xs text-muted-foreground">{formatDateTime(run.createdAt)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{run.summary}</p><p className="mt-3 text-[11px] text-muted-foreground">Provider: {run.provider}</p></article>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center"><SearchCheck className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold">Not analyzed</p><p className="mt-1 text-sm leading-6 text-muted-foreground">No analysis runs have been recorded for this patent.</p></div>}
  </section>;

  const renderEvidence = () => <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)] sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-semibold">Evidence</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Only evidence attached to this patent&apos;s analysis runs is shown here.</p></div><BookOpen className="h-5 w-5 shrink-0 text-primary" /></div>
    {evidenceEntries.length ? <div className="mt-5 space-y-3">{evidenceEntries.map(({ item, index, run }) => <article key={`${run.publicId}-${index}`} className="rounded-xl border border-border bg-muted/25 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold">Recorded evidence</span><span className="text-[11px] text-muted-foreground">{formatDateTime(run.createdAt)}</span></div><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-xs leading-5 text-muted-foreground">{evidenceText(item)}</pre></article>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center"><BookOpen className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold">No evidence recorded</p><p className="mt-1 text-sm leading-6 text-muted-foreground">There is no patent-linked evidence attached to the available analysis runs.</p></div>}
  </section>;

  const renderHistory = () => <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)] sm:p-6">
    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><History className="h-4 w-4" /></span><div><h2 className="font-display text-lg font-semibold">Analysis history</h2><p className="text-xs text-muted-foreground">Recorded project analysis entries for this patent.</p></div></div>
    {patentRuns.length ? <div className="mt-5 space-y-3">{patentRuns.map((run) => <article key={run.publicId} className="rounded-xl border border-border bg-muted/25 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-full bg-card px-2 py-1 text-[10px] font-bold text-muted-foreground">{run.reviewStatus}</span><span className="text-[11px] text-muted-foreground">{run.provider}</span></div><span className="text-[11px] text-muted-foreground">{formatDate(run.createdAt)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{run.summary}</p><p className="mt-2 text-[11px] text-muted-foreground">Triage: {run.triage}</p></article>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-border p-8 text-center"><History className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold">No analysis entries yet</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Review records will appear here when they are recorded for this patent.</p></div>}
  </section>;

  const renderSettings = () => <div className="grid gap-5 lg:grid-cols-3">
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)] sm:p-6 lg:col-span-2">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-semibold">Patent settings</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Actions affect this record only. Existing source data and claim versions remain preserved.</p></div><Settings2 className="h-5 w-5 text-primary" /></div>
      {(refresh.error || monitoring.error || archive.error) && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{(refresh.error || monitoring.error || archive.error) instanceof Error ? (refresh.error || monitoring.error || archive.error)?.message : 'The requested update could not be completed.'}</div>}
      {refresh.isSuccess && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">The source record was refreshed. Previous claim versions remain preserved.</div>}
      <div className="mt-6 divide-y divide-border rounded-xl border border-border">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{isArchived ? 'Record archived' : patent.monitoringActive ? 'Monitoring is active' : 'Monitoring is paused'}</p><p className="mt-1 text-xs text-muted-foreground">{isArchived ? `Archived ${formatDate(patent.archivedAt)}.` : 'Change whether this record is included in active monitoring.'}</p></div>{canManageMonitoring && !isArchived ? <button type="button" disabled={monitoring.isPending} onClick={() => monitoring.mutate(!patent.monitoringActive)} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${patent.monitoringActive ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>{patent.monitoringActive ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}{patent.monitoringActive ? 'Pause monitoring' : 'Resume monitoring'}</button> : <span className="text-xs font-semibold text-muted-foreground">{access?.user?.role === 'CLIENT' ? 'View only' : 'Unavailable'}</span>}</div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">Source record</p><p className="mt-1 text-xs text-muted-foreground">Retrieve the current source record without replacing preserved claim versions.</p></div><button type="button" disabled={refresh.isPending} onClick={() => refresh.mutate()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-muted/50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} /> Refresh record</button></div>
        {canArchive && <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{isArchived ? 'Restore from archive' : 'Archive record'}</p><p className="mt-1 text-xs text-muted-foreground">{isArchived ? 'Return this record to the active project records.' : 'Remove this record from the active portfolio view.'}</p></div><button type="button" onClick={() => setArchivePrompt(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-700">{isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{isArchived ? 'Restore record' : 'Archive record'}</button></div>}
      </div>
    </section>
     <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)] sm:p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-display text-lg font-semibold">Data and versioning</h2></div><p className="mt-4 text-sm leading-6 text-muted-foreground">Source refreshes preserve prior claim versions for review and comparison. This page displays only data returned by the patent and analysis APIs.</p><dl className="mt-5 space-y-4"><DetailField label="Last analyzed" value={formatDateTime(lastAnalyzedAt)} /><DetailField label="Retrieved" value={formatDateTime(patent.retrievedAt)} /><DetailField label="Verification" value={patent.verificationStatus} /></dl></section>
  </div>;

  const sectionContent = { overview: renderOverview(), claims: renderClaims(), findings: renderFindings(), evidence: renderEvidence(), history: renderHistory(), settings: renderSettings() };

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO title={`${patent.patentNumber} · ${patent.title}`} description="Patent monitoring detail" url={`/portal/patents/${patentId}`} />
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <div className="mb-7 flex items-center justify-between gap-4">
          <Link href={`/portal/projects/${data.project.publicId}`} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground transition hover:text-primary"><ArrowLeft className="h-4 w-4" /> {data.project.name}</Link>
          <span className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5" /> Evidence view</span>
        </div>
        <header className="mb-6 flex flex-col gap-4">
          <div className="min-w-0">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{data.client.name} <span className="mx-1.5 text-border">/</span> {data.tool.name}</p>
            <div className="flex flex-wrap items-center gap-3"><h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{patent.patentNumber}</h1><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isArchived ? 'border-slate-300 bg-slate-100 text-slate-600' : patent.monitoringActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{isArchived ? 'Archived' : patent.monitoringActive ? 'Monitoring active' : 'Monitoring paused'}</span></div>
            <p className="mt-2 max-w-4xl text-base leading-6 text-muted-foreground">{patent.title || 'Title unavailable'}</p>
          </div>
        </header>

        <nav aria-label="Patent detail sections" className="sticky top-0 z-10 -mx-4 mb-6 overflow-x-auto border-y border-border bg-background/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:px-2">
          <div className="flex min-w-max gap-1">
            {sectionItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveSection(id)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${activeSection === id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`} aria-current={activeSection === id ? 'page' : undefined}><Icon className="h-3.5 w-3.5" />{label}</button>)}
          </div>
        </nav>

        <main>{sectionContent[activeSection]}</main>
      </div>

      {archivePrompt && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setArchivePrompt(false); }}><div role="dialog" aria-modal="true" aria-labelledby="archive-title" className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Confirm record change</p><h2 id="archive-title" className="mt-2 font-display text-xl font-semibold">{isArchived ? 'Restore this patent?' : 'Archive this patent?'}</h2></div><button type="button" onClick={() => setArchivePrompt(false)} aria-label="Close confirmation" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{isArchived ? 'The patent will return to the active project records. Its source data and claim versions will remain unchanged.' : 'The patent will be removed from the active portfolio view. Its source data and claim versions will remain available in archived records.'}</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setArchivePrompt(false)} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={archive.isPending} onClick={confirmArchive} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${isArchived ? 'bg-primary hover:bg-primary/90' : 'bg-red-700 hover:bg-red-800'}`}>{archive.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{isArchived ? 'Restore record' : 'Archive record'}</button></div></div></div>}
    </div>
  );
}