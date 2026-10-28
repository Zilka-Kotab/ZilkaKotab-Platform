import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { PublicExaminerAnalysis, PublicExaminerBehaviorMetric } from '@workspace/api-client-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fmtNum } from './shared';
import { RceContinuationCard } from './RceContinuationCard';

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}% of applications` : 'Share unavailable');

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`About ${label}`} className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}

function Cell({ label, value, sub, tip, testId, sample }: { label: string; value: string | null; sub?: ReactNode; tip: ReactNode; testId: string; sample?: boolean }) {
  return (
    <div className="min-w-0 bg-white p-3 sm:p-4" data-testid={testId}>
      <div className="flex min-h-[2.5rem] items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase leading-[1.25rem] tracking-[0.12em] text-muted-foreground">{label}</div>
        <Tip label={label}>{tip}</Tip>
      </div>
      {value === null
        ? <div className="mt-1.5 font-display text-lg italic text-muted-foreground/80">Unavailable</div>
        : <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${sample ? 'text-muted-foreground' : 'text-foreground'}`}>{value}</div>}
      {sample && <div className="mt-1 inline-block rounded-sm border border-[hsl(var(--zk-brass)/0.6)] bg-[hsl(var(--zk-brass)/0.1)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground" data-testid={`${testId}-sample-label`}>Illustrative — not USPTO data</div>}
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function behavior(m: PublicExaminerBehaviorMetric | undefined, sample: string, label: string, testId: string, definition: string) {
  const live = m && m.rate !== null;
  return (
    <Cell label={label} testId={testId}
      value={live ? `${m!.rate!.toFixed(1)}%` : sample}
      sample={!live}
      sub={live ? `${fmtNum(m!.numerator)} of ${fmtNum(m!.denominator)}` : undefined}
      tip={<>{definition} {live ? `n = ${fmtNum(m!.denominator)}. ${m!.note}` : `A live value is not available for this examiner${m?.note ? `: ${m.note}` : '.'} The figure shown is an illustrative placeholder, not a USPTO result.`}</>} />
  );
}

export function ExaminerProsecutionBehavior({ data }: { data: PublicExaminerAnalysis }) {
  const oa = data.officeActionAnalytics;
  const ia = data.interviewAnalytics;
  if (!oa && !ia) return null;
  const n = oa?.applicationsWithEventData ?? ia?.applicationsWithEventData ?? 0;

  const wAllowed = ia?.interviewSummaryAllowed ?? 0, wDisposed = ia ? ia.interviewSummaryAllowed + ia.interviewSummaryAbandoned : 0;
  const nAllowed = ia?.noSummaryAllowed ?? 0, nDisposed = ia ? ia.noSummaryAllowed + ia.noSummaryAbandoned : 0;
  const withRate = ia && wDisposed > 0 ? (wAllowed / wDisposed) * 100 : null;
  const withoutRate = ia && nDisposed > 0 ? (nAllowed / nDisposed) * 100 : null;
  const diff = withRate !== null && withoutRate !== null ? withRate - withoutRate : null;
  const rel = withRate !== null && withoutRate !== null && withoutRate > 0 ? ((withRate / withoutRate) - 1) * 100 : null;

  return (
    <TooltipProvider delayDuration={150}>
      <section className="@container rounded-sm border bg-white p-4 sm:p-5" data-testid="section-prosecution-behavior">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="zk-h4">Examiner Prosecution Behavior</h4>
          <span className="text-xs tabular-nums text-muted-foreground" data-testid="text-prosecution-analyzed">{fmtNum(n)} applications analyzed{data.coverage.truncated ? ' (sample)' : ''}</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-2 @3xl:grid-cols-4 @3xl:grid-rows-[auto_auto]">
            {oa ? <>
              <Cell label="Median Time to First Action" testId="metric-first-action-time"
                value={oa.medianMonthsFilingToFirstAction === null ? null : oa.medianMonthsFilingToFirstAction.toFixed(1)}
                sub={oa.medianMonthsFilingToFirstAction === null ? 'Insufficient dated events' : 'months'}
                tip="Median months from filing date to the first qualifying examiner office action, among applications with event histories." />
              <Cell label="Applications with Office Action" testId="metric-office-action-apps" value={fmtNum(oa.applicationsWithOfficeAction)}
                sub={pct(oa.applicationsWithOfficeAction, oa.applicationsWithEventData)}
                tip={`${fmtNum(oa.applicationsWithOfficeAction)} of ${fmtNum(oa.applicationsWithEventData)} applications with event histories. ${fmtNum(oa.applicationsWithFinalRejection)} had a final rejection. Pending applications included.`} />
              <Cell label="Applications with Restriction" testId="metric-restriction-apps" value={fmtNum(oa.applicationsWithRestriction)}
                sub={pct(oa.applicationsWithRestriction, oa.applicationsWithEventData)}
                tip={`${fmtNum(oa.applicationsWithRestriction)} of ${fmtNum(oa.applicationsWithEventData)} applications with event histories had a restriction requirement event.`} />
              <Cell label="Avg. Non-Final / Final Actions" testId="metric-nonfinal-final-actions"
                value={`${oa.averageNonFinalActionsPerApplication.toFixed(2)} / ${oa.averageFinalActionsPerApplication.toFixed(2)}`}
                sub="Non-Final / Final per analyzed application"
                tip={`Average non-final and final actions per application across ${fmtNum(oa.applicationsWithEventData)} applications with event histories. Mailed notices are not double-counted.`} />
              <RceContinuationCard jobId={data.searchType === 'examiner' ? data.rceContinuationJobId : undefined} artUnit={data.searchType === 'art-unit'} />
              {behavior(oa.quarterEndConcentration, '38.5%', 'Quarter-End Action Concentration', 'metric-quarter-end', 'Share of qualifying examiner-issued actions mailed in the final 14 days of March, June, September, or December.')}
            </> : <div className="bg-white p-4 text-sm text-muted-foreground sm:col-span-2 @3xl:col-span-3 @3xl:row-span-2">Office action event data unavailable for this result.</div>}
          <div className="min-w-0 bg-white p-3 outline outline-2 -outline-offset-2 outline-[hsl(var(--primary))] sm:col-span-2 sm:p-4 @3xl:col-span-1 @3xl:col-start-4 @3xl:row-span-2 @3xl:row-start-1" data-testid="panel-interview-impact">
            <div className="flex min-h-[2.5rem] items-start justify-between gap-2">
              <div className="text-sm font-semibold leading-[1.25rem]">Interview Impact</div>
              <Tip label="Interview Impact">Groups are based on located interview summaries, not necessarily all interviews held. Rates use disposed applications only (allowed ÷ allowed + abandoned). The comparison is a correlation, not evidence of causation.</Tip>
            </div>
            {ia ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 @3xl:grid-cols-1">
              {[
                { l: 'Allowance With Interview', r: withRate, a: wAllowed, d: wDisposed, apps: ia.applicationsWithInterviewSummary, o: ia.interviewSummaryOther, t: 'metric-interview-summary-allowance-rate' },
                { l: 'Allowance Without Interview', r: withoutRate, a: nAllowed, d: nDisposed, apps: ia.applicationsWithoutInterviewSummary, o: ia.noSummaryOther, t: 'metric-no-summary-allowance-rate' },
              ].map((x) => (
                <div key={x.t} className="border-t pt-2 first:border-t-0 first:pt-0 sm:border-t-0 sm:pt-0 @3xl:border-t @3xl:pt-2" data-testid={x.t}>
                  <div className="flex min-h-[2.5rem] items-start justify-between gap-2">
                    <div className="text-[11px] font-medium uppercase leading-[1.25rem] tracking-[0.12em] text-muted-foreground">{x.l}</div>
                    <Tip label={x.l}>{`${fmtNum(x.apps)} applications in group: ${fmtNum(x.a)} allowed, ${fmtNum(x.d - x.a)} abandoned, ${fmtNum(x.o)} pending/other (excluded). Based on located interview summaries; correlation, not causation.`}</Tip>
                  </div>
                  {x.r === null ? <div className="mt-1.5 font-display text-lg italic text-muted-foreground/80">Unavailable</div>
                    : <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{x.r.toFixed(1)}%</div>}
                  <div className="text-xs text-muted-foreground">{fmtNum(x.a)} of {fmtNum(x.d)} disposed</div>
                </div>
              ))}
            </div> : <p className="text-sm text-muted-foreground">Interview records unavailable.</p>}
            {ia && <p className="mt-3 border-t pt-2 text-xs leading-relaxed text-muted-foreground" data-testid="interview-allowance-conclusion">
            {diff === null ? 'Not enough disposed applications in both groups for an allowance-rate comparison.'
              : <>Observed: <strong className="text-foreground">{diff >= 0 ? '+' : ''}{diff.toFixed(1)} percentage points</strong>{rel !== null && <> ({rel >= 0 ? '+' : ''}{rel.toFixed(1)}% relative)</>} allowance with a located interview summary. A historical association, not evidence that interviews cause allowance; no summary located does not prove no interview occurred.</>}
          </p>}
          </div>
        </div>
        <div className="mt-3 space-y-1 text-xs leading-relaxed text-muted-foreground">
          <p>Event-code metrics use USPTO prosecution events{data.coverage.truncated ? ' in the retrieved sample' : ''}; pending applications remain in office-action counts but are excluded from allowance rates. Cards marked Illustrative are placeholders, not USPTO data.</p>
        </div>
      </section>
    </TooltipProvider>
  );
}
