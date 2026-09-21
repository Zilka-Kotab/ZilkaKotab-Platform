import { Link, useParams } from 'wouter';
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, Loader2, PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { usePatent, useUpdatePatentMonitoring } from '@/lib/hooks-portal';

function formatDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : 'Not provided';
}

export default function PatentDetail() {
  const patentId = useParams().patentId ?? '';
  const { data, isLoading, error } = usePatent(patentId);
  const monitoring = useUpdatePatentMonitoring(patentId);

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !data) return <div className="p-8"><div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">The patent could not be loaded.</div></div>;

  const independentClaims = data.patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT');
  const dependentClaims = data.patent.claims.filter((claim) => claim.claimType !== 'INDEPENDENT');

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <SEO title={`${data.patent.patentNumber} · ${data.patent.title}`} description="Patent monitoring detail" url={`/portal/patents/${patentId}`} />
      <Link href={`/portal/projects/${data.project.publicId}`} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to project</Link>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{data.tool.name} · {data.client.name}</p>
          <h1 className="font-display text-3xl font-bold text-foreground">{data.patent.patentNumber}</h1>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">{data.patent.title || 'Title unavailable'}</p>
        </div>
        <button type="button" disabled={monitoring.isPending} onClick={() => monitoring.mutate(!data.patent.monitoringActive)} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${data.patent.monitoringActive ? 'border border-amber-300 bg-amber-50 text-amber-900' : 'bg-primary text-white'}`}>
          {data.patent.monitoringActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
          {data.patent.monitoringActive ? 'Pause monitoring' : 'Resume monitoring'}
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold">Overview</h2></div>
          <dl className="grid gap-5 text-sm sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</dt><dd className="mt-1">{data.patent.assignee || 'Not provided'}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Application number</dt><dd className="mt-1">{data.patent.applicationNumber || 'Not provided'}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Inventors</dt><dd className="mt-1">{data.patent.inventors.length ? data.patent.inventors.join(', ') : 'Not provided'}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Patent status</dt><dd className="mt-1">{data.patent.patentStatus}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Filing date</dt><dd className="mt-1">{formatDate(data.patent.filingDate)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Earliest priority date</dt><dd className="mt-1">{formatDate(data.patent.earliestPriorityDate)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Issue date</dt><dd className="mt-1">{formatDate(data.patent.issueDate)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Retrieved</dt><dd className="mt-1">{data.patent.retrievedAt ? new Date(data.patent.retrievedAt).toLocaleString() : 'Not provided'}</dd></div>
          </dl>
          {data.patent.abstract && <div className="mt-6 border-t border-border pt-5"><h3 className="text-sm font-semibold">Abstract</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{data.patent.abstract}</p></div>}
          {data.patent.sourceUrl && <a href={data.patent.sourceUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">View USPTO source document</a>}
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /><h2 className="font-semibold">Monitoring</h2></div>
          <p className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${data.patent.monitoringActive ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{data.patent.monitoringActive ? 'Monitoring active' : 'Monitoring paused'}</p>
          <dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Last analyzed</dt><dd className="mt-1">{data.patent.lastAnalyzedAt ? new Date(data.patent.lastAnalyzedAt).toLocaleString() : 'Not analyzed yet'}</dd></div><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Next scheduled analysis</dt><dd className="mt-1 text-muted-foreground">Future functionality</dd></div></dl>
          {monitoring.error && <p className="mt-4 text-sm text-red-700">{monitoring.error instanceof Error ? monitoring.error.message : 'Monitoring state could not be updated.'}</p>}
        </section>

        <section className="rounded-2xl border border-border bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-border p-6"><h2 className="font-semibold">Claims</h2><p className="mt-1 text-sm text-muted-foreground">{independentClaims.length} independent · {dependentClaims.length} dependent</p></div>
          <div className="divide-y divide-border">
            {independentClaims.map((claim) => <article key={claim.publicId} className="p-6"><div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${claim.selectedForMonitoring ? 'text-green-600' : 'text-muted-foreground'}`} /><h3 className="font-semibold">Claim {claim.claimNumber}</h3>{claim.selectedForMonitoring && <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Selected for monitoring</span>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{claim.claimText}</p></article>)}
            {dependentClaims.length > 0 && <details className="p-6"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><ChevronDown className="h-4 w-4" /> Dependent claims</summary><div className="mt-4 space-y-4">{dependentClaims.map((claim) => <article key={claim.publicId} className="rounded-lg bg-muted/30 p-4"><h3 className="font-semibold">Claim {claim.claimNumber}{claim.dependsOnClaimNumber && <span className="ml-2 text-xs font-normal text-muted-foreground">depends on claim {claim.dependsOnClaimNumber}</span>}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{claim.claimText}</p></article>)}</div></details>}
            {!data.patent.claims.length && <p className="p-8 text-center text-sm text-muted-foreground">No claims are stored for this patent.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Findings</h2><p className="mt-2 text-sm text-muted-foreground">No findings yet. AI infringement analysis has not been enabled.</p>
          <div className="mt-6 border-t border-border pt-5"><h3 className="font-semibold">Analysis history</h3>{data.analysisRuns.length ? <div className="mt-3 space-y-3">{data.analysisRuns.map((run) => <div key={run.publicId} className="rounded-lg bg-muted/30 p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{run.triage}</span><span className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleDateString()}</span></div><p className="mt-2 text-muted-foreground">{run.summary}</p></div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">No analysis runs yet.</p>}</div>
        </section>
      </div>
    </div>
  );
}