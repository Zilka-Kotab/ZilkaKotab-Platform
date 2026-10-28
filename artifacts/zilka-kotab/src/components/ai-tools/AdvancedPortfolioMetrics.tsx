import { useAnalyzePublicPortfolioAdvanced } from '@workspace/api-client-react';
import type { ReactNode } from 'react';
import { Metric, fmtNum } from './shared';
import { FirmBenchmarkLine, FirmInvolvementBadge, hasLines } from './firm-benchmark';

export function AdvancedPortfolioMetrics({ applicantNames, request }: {
  applicantNames: string[];
  request: ReturnType<typeof useAnalyzePublicPortfolioAdvanced>;
}) {

  if (request.isPending) {
    return <section aria-live="polite" className="space-y-3" data-testid="advanced-portfolio-loading">
      <h4 className="zk-h4">Advanced portfolio metrics</h4>
      <p className="text-sm text-muted-foreground">Loading prosecution histories separately. The portfolio snapshot remains available.</p>
      <div className="h-20 animate-pulse rounded-sm bg-muted" />
    </section>;
  }
  if (request.isError) {
    return <section className="border p-4" data-testid="advanced-portfolio-error">
      <h4 className="zk-h4">Advanced portfolio metrics unavailable</h4>
      <p className="mt-1 text-sm text-muted-foreground">The main portfolio results are still available. {request.error instanceof Error ? request.error.message : 'USPTO prosecution-history data could not be loaded.'}</p>
      <button type="button" className="mt-3 text-sm text-primary underline underline-offset-4" onClick={() => request.mutate({ data: { selectedApplicantNames: applicantNames } })}>Retry advanced metrics</button>
    </section>;
  }
  if (!request.data) return null;
  const fb = request.data.firmBenchmark;
  const { prosecutionEfficiency: e, topArtUnits, outsideCounsel, portfolioInsights: p, coverage } = request.data;

  return (
    <section className="space-y-7" data-testid="advanced-portfolio-metrics">
      <header>
        <h4 className="zk-h4">Prosecution Efficiency</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Based on {fmtNum(e.applicationsWithHistories)} applications with prosecution histories
          {coverage.truncated ? ` in a ${fmtNum(coverage.recordsAnalyzed)}-record sample` : ''}.
          {e.filingDateStart && e.filingDateEnd ? ` Filing dates: ${e.filingDateStart} to ${e.filingDateEnd}.` : ''}
          {coverage.truncated ? ' Systematic sampling spans the full search result range, not only the newest filings.' : ''}
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <EfficiencyGauge label="Avg. Office Actions per Patent" value={e.averageOfficeActionsPerGrantedPatent?.toFixed(2) ?? 'N/A'} note={`Granted cases with history: n=${fmtNum(e.officeActionDenominator)}. Counts non-final and final actions.`} bench={<FirmBenchmarkLine fb={fb} metric="officeActionsPerPatent" align="center" testId="benchmark-office-actions" />} />
        <EfficiencyGauge label="RCE Rate" value={e.rceRate === null ? 'N/A' : `${e.rceRate.toFixed(1)}%`} note={`${fmtNum(e.rceApplications)} of ${fmtNum(e.rceDenominator)} applications had at least one RCEX event.`} rate={e.rceRate} bench={<FirmBenchmarkLine fb={fb} metric="rceRate" align="center" testId="benchmark-rce-rate" />} />
        <EfficiencyGauge label="Examiner Interview Rate" value={e.examinerInterviewRate === null ? 'N/A' : `${e.examinerInterviewRate.toFixed(1)}%`} note={`${fmtNum(e.interviewApplications)} of ${fmtNum(e.interviewDenominator)} applications had a documented interview event.`} rate={e.examinerInterviewRate} />
        <EfficiencyGauge label="Allowed With ≤2 Office Actions" value={e.allowedWithTwoOrFewerActionsRate === null ? 'N/A' : `${e.allowedWithTwoOrFewerActionsRate.toFixed(1)}%`} note={`${fmtNum(e.allowedWithTwoOrFewerActions)} of ${fmtNum(e.allowedWithHistory)} allowed cases with history.`} rate={e.allowedWithTwoOrFewerActionsRate} bench={<FirmBenchmarkLine fb={fb} metric="allowedWithTwoActionsRate" align="center" testId="benchmark-allowed-two-actions" />} />
      </div>
      <p className="-mt-4 text-xs text-muted-foreground">USPTO prosecution events: CTNF / CTFR (substantive actions), RCEX (RCE), and EXIN / EXAT / EXET (interview summaries). Rates are withheld when the metric denominator is under 10; recent records may not include full event histories.</p>
      {hasLines(fb) && fb && <p className="-mt-5 border-l-2 border-[hsl(var(--zk-brass))] pl-3 text-xs leading-relaxed text-muted-foreground" data-testid="text-firm-benchmark-footnote">{fb.footnote}</p>}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h4 className="zk-h4">Top USPTO Art Units</h4>
          <p className="mt-1 text-xs text-muted-foreground">Distinct application counts and share of the identified portfolio.</p>
          <div className="mt-4 space-y-3">
            {topArtUnits.map((item) => (
              <div key={item.artUnit} data-testid={`row-portfolio-art-unit-${item.artUnit}`}>
                <div className="flex justify-between gap-3 text-sm"><span>Art Unit <strong>{item.artUnit}</strong></span><span className="tabular-nums">{fmtNum(item.applicationCount)} · {item.portfolioSharePercent.toFixed(1)}%</span></div>
                <div className="mt-1.5 h-1.5 bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, item.portfolioSharePercent)}%` }} /></div>
              </div>
            ))}
            {!topArtUnits.length && <p className="text-sm text-muted-foreground">Art unit data unavailable.</p>}
          </div>
        </section>
        <section>
          <h4 className="zk-h4">{!outsideCounsel.available && fb && fb.excludedApplications > 0 ? 'Zilka-Kotab Prosecution Involvement' : outsideCounsel.label}</h4>
          {outsideCounsel.entries.length ? (
            <ol className="mt-3 space-y-3" data-testid="top-outside-counsel">
              {outsideCounsel.entries.map((entry, index) => {
                const maxCount = Math.max(...outsideCounsel.entries.map((item) => item.applicationCount), 1);
                return (
                  <li key={entry.name} className="text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate"><span className="mr-2 text-xs text-muted-foreground">{index + 1}.</span>{entry.name}</span>
                      <span className="shrink-0 tabular-nums">{fmtNum(entry.applicationCount)} · {entry.portfolioSharePercent.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-muted">
                      <div className="h-full bg-[hsl(var(--zk-brass))]" style={{ width: `${(entry.applicationCount / maxCount) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : !outsideCounsel.available && fb && fb.excludedApplications > 0
            ? <div className="mt-3" data-testid="outside-counsel-firm-involvement"><FirmInvolvementBadge fb={fb} testId="badge-firm-involvement-counsel" /></div>
            : <p className="mt-2 text-sm text-muted-foreground">{outsideCounsel.note}</p>}
          {outsideCounsel.entries.length > 0 && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{outsideCounsel.note}</p>}
        </section>
      </div>

      <section>
        <h4 className="zk-h4">Portfolio Prosecution Insights</h4>
        <div className="mt-4 grid gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-3">
          <BenchCell bench={<FirmBenchmarkLine fb={fb} metric="allowanceRate" testId="benchmark-allowance-rate" />}><Metric label="Overall Allowance Rate" value={p.overallAllowanceRate === null ? null : `${p.overallAllowanceRate.toFixed(1)}%`} note={`${fmtNum(p.knownFinalOutcomes)} known allowed/granted or abandoned outcomes; pending excluded.`} testId="metric-portfolio-allowance-rate" /></BenchCell>
          <BenchCell bench={<FirmBenchmarkLine fb={fb} metric="timeToGrantYears" testId="benchmark-time-to-grant" />}><Metric label="Average Time to Grant" value={p.averageTimeToGrantMonths === null ? null : `${(p.averageTimeToGrantMonths / 12).toFixed(1)} years`} note={`Valid filing and grant dates; sample n=${fmtNum(p.grantDurationSampleSize)}.`} testId="metric-portfolio-time-to-grant" /></BenchCell>
          <Metric label="Average Age of Pending Applications" value={p.averagePendingAgeYears === null ? null : `${p.averagePendingAgeYears.toFixed(1)} years`} note={`Pending sample n=${fmtNum(p.pendingAgeSampleSize)}.`} testId="metric-portfolio-pending-age" className="sm:border-l sm:border-border" />
        </div>
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <div>
            <h5 className="text-sm font-semibold">Pending applications by age</h5>
            <div className="mt-3 space-y-2">
              {p.pendingAgeBuckets.map((bucket) => (
                <div key={bucket.label} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-xs">
                  <span>{bucket.label}</span><div className="h-2 bg-muted"><div className="h-full bg-[hsl(var(--zk-brass))]" style={{ width: `${bucket.sharePercent}%` }} /></div>
                  <span className="tabular-nums">{fmtNum(bucket.count)} · {bucket.sharePercent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h5 className="text-sm font-semibold">Top Examiners</h5>
            <p className="mt-1 text-xs text-muted-foreground">Counts from the retrieved application sample (n={fmtNum(p.examinerSampleSize)}).</p>
            {p.topExaminers.length ? <ol className="mt-3 space-y-2">
              {p.topExaminers.map((examiner, index) => <li key={examiner.examinerName} className="flex justify-between gap-3 border-b pb-2 text-sm">
                <span>{index + 1}. {examiner.examinerName}{examiner.artUnit ? <span className="ml-2 font-mono text-xs text-muted-foreground">AU {examiner.artUnit}</span> : null}</span>
                <span className="tabular-nums">{fmtNum(examiner.applicationCount)}</span>
              </li>)}
            </ol> : <p className="mt-2 text-sm text-muted-foreground">Examiner details unavailable in this sample.</p>}
          </div>
        </div>
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">{coverage.note} Overall allowance rate uses current USPTO status facets and excludes pending applications. Grant-duration and pending-age figures use only records with valid dates.</p>
    </section>
  );
}

function BenchCell({ bench, children }: { bench: ReactNode; children: ReactNode }) {
  if (!bench) return <>{children}</>;
  return <div className="flex flex-col bg-background [&>.zk-metric]:flex-1">{children}<div className="px-5 pb-4">{bench}</div></div>;
}

function EfficiencyGauge({ label, value, note, rate, bench }: { label: string; value: string; note: string; rate?: number | null; bench?: ReactNode }) {
  const progress = rate === undefined || rate === null ? 0 : Math.max(0, Math.min(100, rate));
  return (
    <article className="flex flex-col items-center border bg-white p-4 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full" style={{ background: rate === undefined ? 'transparent' : `conic-gradient(hsl(var(--primary)) ${progress}%, hsl(var(--muted)) ${progress}% 100%)` }}>
        <div className="absolute inset-[5px] rounded-full bg-white" />
        <strong className="relative font-display text-xl tabular-nums">{value}</strong>
      </div>
      <h5 className="mt-3 text-sm font-semibold">{label}</h5>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
      {bench}
    </article>
  );
}
