import type { ReactNode } from 'react';
import { Info, RotateCw } from 'lucide-react';
import { useGetPublicExaminerRceContinuation } from '@workspace/api-client-react';
import type { PublicExaminerBehaviorMetric, PublicExaminerRceContinuation } from '@workspace/api-client-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fmtNum } from './shared';

const RCE_DEF = 'Percentage of eligible applications with at least one Request for Continued Examination. Multiple RCE filings in the same application count only once.';
const CON_DEF = 'Percentage of eligible parent applications with at least one subsequently filed continuation application. Excludes divisionals and continuations-in-part.';

const fmtDate = (s: string | null | undefined) => {
  if (!s) return 'not yet retrieved';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`About ${label}`} className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-h-[70vh] max-w-xs overflow-y-auto leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

function Rate({ label, def, m, job, reason, testId }: { label: string; def: string; m?: PublicExaminerBehaviorMetric; job?: PublicExaminerRceContinuation; reason: string; testId: string }) {
  const live = m != null && m.rate !== null;
  return (
    <div className="min-w-0" data-testid={testId}>
      {live
        ? <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground" data-testid={`${testId}-value`}>{m!.rate!.toFixed(1)}%</div>
        : <div className="mt-1 font-display text-2xl font-semibold text-muted-foreground/70" data-testid={`${testId}-value`}>N/A</div>}
      <div className="flex h-5 items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <Tip label={`${label} rate`}>
          <span className="block">{def}</span>
          <span className="mt-1 block">
            {m ? `Numerator ${fmtNum(m.numerator)} / denominator ${fmtNum(m.denominator)}.` : 'Numerator / denominator not yet available.'}
            {' '}Data retrieved: {fmtDate(job?.retrievedAt)}.
          </span>
          {m?.note && <span className="mt-1 block">{m.note}</span>}
          {!live && <span className="mt-1 block">Shown as N/A: {reason}</span>}
          {job && <span className="mt-1 block text-[11px] opacity-80">Cohort: filed on/after 2001 and on/before {job.cohortCutoff}; {fmtNum(job.excludedApplications)} excluded. Version {job.calculationVersion}.{job.note ? ` ${job.note}` : ''}</span>}
        </Tip>
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">{live ? `${fmtNum(m!.numerator)} of ${fmtNum(m!.denominator)}` : '—'}</div>
    </div>
  );
}

export function RceContinuationCard({ jobId, artUnit = false }: { jobId?: string; artUnit?: boolean }) {
  const id = jobId ?? '';
  const q = useGetPublicExaminerRceContinuation(id, {
    query: {
      enabled: !!jobId,
      retry: 2,
      queryKey: ['/api/public-tools/examiner/rce-continuation', id],
      refetchInterval: (query) => {
        const s = query.state.data?.state;
        if (query.state.status === 'error') return false;
        return s === 'complete' ? false : s === 'partial' ? 30000 : 3000;
      },
    },
  });
  const job = jobId ? q.data : undefined;
  const pending = !!jobId && (!job || job.state === 'queued' || job.state === 'running') && !q.isError;

  let reason: string;
  let status: string;
  if (!jobId) {
    reason = artUnit ? 'requires a specific examiner; not calculated for art-unit profiles.' : 'the evidence analysis could not be started. Run the examiner search again.';
    status = artUnit ? 'Select a specific examiner' : 'Analysis unavailable';
  } else if (q.isError) {
    reason = 'the continuity analysis could not be retrieved.';
    status = 'Analysis unavailable';
  } else if (!job) {
    reason = 'analysis is starting.';
    status = 'Starting continuity check…';
  } else if (pending) {
    reason = 'still being calculated from USPTO records.';
    status = job.state === 'queued' ? 'Queued' : `Checking ${fmtNum(job.completedApplications)}/${fmtNum(job.eligibleApplications)}`;
  } else {
    reason = 'insufficient source coverage for a reliable rate; errors are not counted as negatives.';
    status = job.state === 'partial' ? 'Partial coverage' : `Retrieved ${fmtDate(job.retrievedAt)}`;
  }
  const canRetry = !!jobId && (q.isError || job?.state === 'partial');

  return (
    <div className="min-w-0 bg-white p-3 sm:p-4" data-testid="metric-rce-vs-continuation">
      <div className="min-h-10 text-[11px] font-medium uppercase leading-5 tracking-[0.12em] text-muted-foreground">RCE vs. Continuation Rate</div>
      <div className="grid grid-cols-2 divide-x">
        <div className="pr-2"><Rate label="RCE" def={RCE_DEF} m={job?.rce} job={job} reason={reason} testId="metric-rce-rate" /></div>
        <div className="pl-2"><Rate label="Continuation" def={CON_DEF} m={job?.continuation} job={job} reason={reason} testId="metric-continuation-rate" /></div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        {pending && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[hsl(var(--zk-brass))]" aria-hidden />}
        <span aria-live="polite" title={status} className="truncate" data-testid="text-rce-continuation-status">{status}</span>
        {canRetry && (
          <button type="button" onClick={() => q.refetch()} disabled={q.isFetching} className="ml-auto inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" data-testid="button-rce-continuation-retry">
             <RotateCw className={`h-3 w-3 ${q.isFetching ? 'animate-spin' : ''}`} />Refresh
          </button>
        )}
      </div>
    </div>
  );
}
