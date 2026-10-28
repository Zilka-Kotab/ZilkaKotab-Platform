import type { ReactNode } from 'react';
import type { PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis, useAnalyzePublicPortfolioAdvanced } from '@workspace/api-client-react';
import { CoverageLedger, fmtDate, fmtNum } from './shared';
import { QuestionsWorthAsking, QuestionsContactCTA } from './QuestionsWorthAsking';
import type { PublicFirmBenchmarkLinesItemMetric } from '@workspace/api-client-react';
import { NameDiscoveryPanel } from './CompanyNameScope';
import { FirmBenchmarkLine, FirmInvolvementBadge, hasLines } from './firm-benchmark';

type Side = {
  data: PublicPortfolioAnalysis;
  advanced?: PublicPortfolioAdvancedAnalysis;
  request: ReturnType<typeof useAnalyzePublicPortfolioAdvanced>;
};

let scopeSides: Side[] = [];
const scopeIndex = (s: Side) => scopeSides.indexOf(s);
const NA = <span className="text-sm font-normal text-muted-foreground">Unavailable</span>;
const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : `${v.toFixed(1)}%`);

function adv(side: Side, pick: (a: PublicPortfolioAdvancedAnalysis) => ReactNode | null, metric?: PublicFirmBenchmarkLinesItemMetric): ReactNode {
  if (side.advanced) {
    const v = pick(side.advanced);
    const base = v === null || v === undefined || v === false ? NA : v;
    if (!metric) return base;
    // Each side uses only its own scope's server-provided benchmark lines.
    return <>{base}<FirmBenchmarkLine fb={side.advanced.firmBenchmark} metric={metric} align="right" testId={`benchmark-compare-${metric}-${scopeIndex(side)}`} /></>;
  }
  if (side.request.isPending) return <span className="inline-block h-4 w-14 animate-pulse bg-muted align-middle" aria-label="Loading" />;
  return NA;
}

export function PortfolioComparison({ a, b, onReplace, onExit }: { a: Side; b: Side; onReplace: () => void; onExit: () => void }) {
  const sides = [a, b];
  scopeSides = sides;
  const rows: { label: string; note?: string; get: (s: Side) => ReactNode }[] = [
    { label: 'Granted (status unverified)', note: 'Not an active-patent count.', get: (s) => fmtNum(s.data.identifiedGrantedPatents) },
    { label: 'Identified pending', get: (s) => fmtNum(s.data.identifiedPendingApplications) },
    { label: 'Expired / inactive identified', get: (s) => (s.data.expiredInactivePatents === null ? NA : fmtNum(s.data.expiredInactivePatents)) },
    { label: 'Grants in last 12 months', get: (s) => fmtNum(s.data.recentGrantCount) },
  ];
  const prosecution: typeof rows = [
    { label: 'Overall allowance rate', note: 'Known allowed/granted vs. abandoned outcomes; pending excluded.', get: (s) => adv(s, (x) => pct(x.portfolioInsights.overallAllowanceRate) && <>{pct(x.portfolioInsights.overallAllowanceRate)}<Sub>n={fmtNum(x.portfolioInsights.knownFinalOutcomes)}</Sub></>, 'allowanceRate') },
    { label: 'Abandonment share of known outcomes', note: 'Derived as the complement of allowance rate on the same known outcomes.', get: (s) => adv(s, (x) => x.portfolioInsights.overallAllowanceRate === null ? null : <>{(100 - x.portfolioInsights.overallAllowanceRate).toFixed(1)}%<Sub>n={fmtNum(x.portfolioInsights.knownFinalOutcomes)}</Sub></>) },
    { label: 'Average time to grant', get: (s) => adv(s, (x) => x.portfolioInsights.averageTimeToGrantMonths === null ? null : <>{(x.portfolioInsights.averageTimeToGrantMonths / 12).toFixed(1)} yrs<Sub>n={fmtNum(x.portfolioInsights.grantDurationSampleSize)}</Sub></>, 'timeToGrantYears') },
    { label: 'Average age of pending applications', get: (s) => adv(s, (x) => x.portfolioInsights.averagePendingAgeYears === null ? null : <>{x.portfolioInsights.averagePendingAgeYears.toFixed(1)} yrs<Sub>n={fmtNum(x.portfolioInsights.pendingAgeSampleSize)}</Sub></>) },
    { label: 'Avg. office actions per granted patent', get: (s) => adv(s, (x) => x.prosecutionEfficiency.averageOfficeActionsPerGrantedPatent === null ? null : <>{x.prosecutionEfficiency.averageOfficeActionsPerGrantedPatent.toFixed(2)}<Sub>n={fmtNum(x.prosecutionEfficiency.officeActionDenominator)}</Sub></>, 'officeActionsPerPatent') },
    { label: 'RCE rate', get: (s) => adv(s, (x) => pct(x.prosecutionEfficiency.rceRate) && <>{pct(x.prosecutionEfficiency.rceRate)}<Sub>n={fmtNum(x.prosecutionEfficiency.rceDenominator)}</Sub></>, 'rceRate') },
    { label: 'Examiner interview rate', get: (s) => adv(s, (x) => pct(x.prosecutionEfficiency.examinerInterviewRate) && <>{pct(x.prosecutionEfficiency.examinerInterviewRate)}<Sub>n={fmtNum(x.prosecutionEfficiency.interviewDenominator)}</Sub></>) },
    { label: 'Allowed with two or fewer office actions', get: (s) => adv(s, (x) => pct(x.prosecutionEfficiency.allowedWithTwoOrFewerActionsRate) && <>{pct(x.prosecutionEfficiency.allowedWithTwoOrFewerActionsRate)}<Sub>n={fmtNum(x.prosecutionEfficiency.allowedWithHistory)}</Sub></>, 'allowedWithTwoActionsRate') },
  ];

  return (
    <div className="space-y-10" data-testid="portfolio-comparison">
      <div className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-[hsl(var(--zk-brass))] bg-[hsl(var(--zk-brass)/0.06)] px-4 py-3">
        <p className="text-sm">Comparing <strong>{a.data.companyName}</strong> with <strong data-testid="text-compare-company">{b.data.companyName}</strong>. Figures are shown side by side; no ranking is implied.</p>
        <div className="flex gap-4 text-sm">
          <button type="button" className="text-primary underline underline-offset-4" onClick={onReplace} data-testid="button-replace-compare">Change second company</button>
          <button type="button" className="text-primary underline underline-offset-4" onClick={onExit} data-testid="button-exit-compare">Exit comparison</button>
        </div>
      </div>

      <CompareTable title="Portfolio counts" sides={sides} rows={rows} />

      <section>
        <h4 className="zk-h4">Prosecution outcomes and efficiency</h4>
        <p className="mt-1 text-xs text-muted-foreground">From each company's own prosecution-history sample. Rates are withheld below a denominator of 10. Sample sizes differ, so direct comparisons should be read with care.</p>
        {sides.map((s, i) => s.request.isError && (
          <p key={i} className="mt-2 text-xs text-muted-foreground" role="alert">Advanced metrics for {s.data.companyName} could not be loaded.{' '}
            <button type="button" className="text-primary underline underline-offset-4" onClick={() => s.request.mutate({ data: { selectedApplicantNames: s.data.matchedApplicantNames } })} data-testid={`button-retry-advanced-${i}`}>Retry</button>
          </p>
        ))}
        <CompareTable sides={sides} rows={prosecution} />
        {sides.map((s, i) => s.advanced?.firmBenchmark && (hasLines(s.advanced.firmBenchmark) || s.advanced.firmBenchmark.excludedApplications > 0) ? (
          <div key={i} className="mt-3 space-y-2 text-xs text-muted-foreground" data-testid={`firm-benchmark-scope-${i}`}>
            <p className="font-semibold text-foreground">{s.data.companyName}</p>
            <FirmInvolvementBadge fb={s.advanced.firmBenchmark} testId={`badge-firm-involvement-compare-${i}`} />
            {hasLines(s.advanced.firmBenchmark) && <p className="border-l-2 border-[hsl(var(--zk-brass))] pl-3 leading-relaxed" data-testid={`text-firm-benchmark-footnote-${i}`}>{s.advanced.firmBenchmark.footnote}</p>}
          </div>
        ) : null)}
      </section>

      <section>
        <h4 className="zk-h4">Filing trend, last five years</h4>
        <p className="mt-1 text-xs text-muted-foreground">Recent years undercount: most applications publish about 18 months after filing.</p>
        <TrendCompare a={a.data} b={b.data} />
      </section>

      <section>
        <h4 className="zk-h4">Leading technology areas</h4>
        <p className="mt-1 text-xs text-muted-foreground">CPC classification occurrences, not unique patents.</p>
        <div className="mt-4 grid gap-8 md:grid-cols-2">
          {sides.map((s, i) => <TechList key={i} side={s.data} tone={i} />)}
        </div>
      </section>

      <QuestionsWorthAsking tool="portfolio" />
      <section className="space-y-6">
        <h4 className="zk-h4">Sources and coverage</h4>
        <div className="grid gap-6 lg:grid-cols-2">
          {sides.map((s, i) => (
            <div key={i}>
              <p className="mb-2 text-sm font-semibold">{s.data.companyName}</p>
              <p className="mb-2 text-xs text-muted-foreground">Applicant names: {s.data.matchedApplicantNames.join('; ') || 'none reported'}</p>
              <p className="mb-2 text-xs text-muted-foreground">Data as of {fmtDate(s.data.coverage.retrievedAt)}.</p>
              {s.data.nameDiscovery && <div className="mb-2"><NameDiscoveryPanel discovery={s.data.nameDiscovery} testId={`panel-name-discovery-compare-result-${i}`} /></div>}
              <CoverageLedger coverage={s.data.coverage} testId={`coverage-compare-${i}`}
                extra={s.advanced ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Prosecution sample.</strong> {fmtNum(s.advanced.coverage.recordsAnalyzed)} records analyzed of {fmtNum(s.advanced.coverage.totalMatchesReported)} reported{s.advanced.coverage.truncated ? ' (sampled)' : ''}. {s.advanced.coverage.note}</p> : undefined} />
            </div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Legal status limitation.</strong> USPTO status text reflects prosecution records only. It does not confirm maintenance-fee payment, ownership after assignment, expiration, or enforceability. This is not a legal opinion.</p>
      </section>

      <QuestionsContactCTA />
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{children}</span>;
}

function CompareTable({ title, sides, rows }: { title?: string; sides: Side[]; rows: { label: string; note?: string; get: (s: Side) => ReactNode }[] }) {
  return (
    <section>
      {title && <h4 className="zk-h4">{title}</h4>}
      <div className="mt-3 divide-y rounded-sm border md:hidden">
        {rows.map(r => <div key={r.label} className="p-4">
          <p className="text-sm font-medium">{r.label}</p>
          {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
          <div className="mt-3 grid grid-cols-2 gap-4">
            {sides.map((side, i) => <div key={i} className="min-w-0">
              <p className="break-words text-xs font-medium text-muted-foreground">{side.data.companyName}</p>
              <div className="mt-1 font-display text-lg tabular-nums">{r.get(side)}</div>
            </div>)}
          </div>
        </div>)}
      </div>
      <div className="mt-3 hidden overflow-x-auto rounded-sm border md:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">Measure</th>{sides.map((s, i) => <th key={i} className="px-4 py-2.5 text-right font-medium normal-case tracking-normal text-foreground">{s.data.companyName}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.label} className="border-t">
                <td className="px-4 py-3"><span className="font-medium">{r.label}</span>{r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}</td>
                {sides.map((s, i) => <td key={i} className="px-4 py-3 text-right font-display text-lg tabular-nums" data-testid={`cell-compare-${ri}-${i}`}>{r.get(s)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TrendCompare({ a, b }: { a: PublicPortfolioAnalysis; b: PublicPortfolioAnalysis }) {
  const years = Array.from(new Set([...a.filingTrends, ...b.filingTrends].map((t) => t.year))).sort();
  if (!years.length) return <p className="mt-3 text-sm text-muted-foreground">No filing dates available for either company.</p>;
  const get = (d: PublicPortfolioAnalysis, y: number) => d.filingTrends.find((t) => t.year === y)?.count;
  const max = Math.max(1, ...years.flatMap((y) => [get(a, y) ?? 0, get(b, y) ?? 0]));
  return (
    <div className="mt-4 rounded-sm border bg-card/50 p-4" data-testid="chart-compare-trends">
      <div className="mb-3 flex flex-wrap gap-4 text-xs"><Legend tone={0} name={a.companyName} /><Legend tone={1} name={b.companyName} /></div>
      <div className="space-y-3">
        {years.map((y) => (
          <div key={y} className="grid grid-cols-[3rem_1fr] items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">{y}</span>
            <div className="space-y-1">
              {[a, b].map((d, i) => { const v = get(d, y); return (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2.5 flex-1 bg-muted"><div className={`h-full ${i ? 'bg-[hsl(var(--zk-brass))]' : 'bg-primary'}`} style={{ width: `${((v ?? 0) / max) * 100}%` }} /></div>
                  <span className="w-20 text-right text-xs tabular-nums">{v === undefined ? <span className="text-muted-foreground">Not reported</span> : fmtNum(v)}</span>
                </div>); })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ tone, name }: { tone: number; name: string }) {
  return <span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 ${tone ? 'bg-[hsl(var(--zk-brass))]' : 'bg-primary'}`} />{name}</span>;
}

function TechList({ side, tone }: { side: PublicPortfolioAnalysis; tone: number }) {
  const max = Math.max(1, ...side.topTechnologyAreas.map((t) => t.count));
  return (
    <div>
      <p className="text-sm font-semibold"><Legend tone={tone} name={side.companyName} /></p>
      {side.topTechnologyAreas.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Classification data unavailable.</p> : (
        <ul className="mt-3 space-y-3">
          {side.topTechnologyAreas.map((t) => (
            <li key={t.code}>
              <div className="flex justify-between gap-3 text-sm"><span><span className="mr-2 font-mono text-xs text-[hsl(var(--zk-brass))]">{t.code}</span>{t.label}</span><span className="tabular-nums">{fmtNum(t.count)}</span></div>
              <div className="mt-1 h-1 bg-muted"><div className={`h-full ${tone ? 'bg-[hsl(var(--zk-brass))]' : 'bg-primary'}`} style={{ width: `${(t.count / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
