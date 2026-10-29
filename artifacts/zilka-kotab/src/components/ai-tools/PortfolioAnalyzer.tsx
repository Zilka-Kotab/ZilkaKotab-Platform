import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, GitCompareArrows, Search, X } from 'lucide-react';
import { useAnalyzePublicPortfolio, useAnalyzePublicPortfolioAdvanced } from '@workspace/api-client-react';
import type { PublicPortfolioAnalysis } from '@workspace/api-client-react';
import { AdvancedPortfolioMetrics } from './AdvancedPortfolioMetrics';
import { PortfolioSnapshotPdfButton } from './PortfolioSnapshotPdfButton';
import { SnapshotPdfChooser } from './SnapshotPdfChooser';
import { RecentPortfolioRecords } from './RecentPortfolioRecords';
import { MatchedApplicantNames } from './MatchedApplicantNames';
import { CompareCompanyDialog } from './CompareCompanyDialog';
import { PortfolioComparison } from './PortfolioComparison';
import { advancedFor } from './portfolio-compare-utils';
import { FirmInvolvementBadge } from './firm-benchmark';
import { QuestionsWorthAsking, QuestionsContactCTA } from './QuestionsWorthAsking';
import { AliasField, NameDiscoveryPanel, SelectionControls, aliasPayload, parseAliases, MAX_APPLICANT_NAMES } from './CompanyNameScope';
import { CoverageLedger, EmptyPanel, ErrorPanel, Metric, ResultSkeleton, errorMessage, fmtDate, fmtNum } from './shared';

export function PortfolioAnalyzer() {
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selectedNames, setSelectedNames] = useState<string[] | null>(null);
  const [aliasText, setAliasText] = useState('');
  const [submittedAliases, setSubmittedAliases] = useState<string[]>([]);
  const m = useAnalyzePublicPortfolio();
  const aliases = parseAliases(aliasText);
  const valid = company.trim().length >= 2 && !aliases.error;

  const run = (name: string, aliasNames: string[], names?: string[]) => {
    setSubmitted(name);
    setSubmittedAliases(aliasNames);
    setSelectedNames(names ?? null);
    m.mutate({ data: { companyName: name, ...aliasPayload(aliasNames), ...(names ? { selectedApplicantNames: names } : {}) } });
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (valid && !m.isPending) run(company.trim(), aliases.names); };

  return (
    <div>
      <form onSubmit={onSubmit} className="zk-query">
        <label htmlFor="portfolio-company" className="zk-query-label">Company or assignee name</label>
        <div className="zk-query-row">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input id="portfolio-company" value={company} onChange={(e) => { setCompany(e.target.value); setSelectedNames(null); }} maxLength={120}
            placeholder="e.g. Rambus Inc." className="zk-query-input" autoComplete="organization" data-testid="input-portfolio-company" />
          <button type="submit" disabled={!valid || m.isPending} className="zk-btn-primary" data-testid="button-analyze-portfolio">
            {m.isPending ? 'Analyzing' : 'Analyze portfolio'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Searches public USPTO application data by applicant name. Related name variants are suggested automatically; add known DBA or former names below. Subsidiaries may need separate searches.</p>
        <AliasField value={aliasText} onChange={(v) => { setAliasText(v); setSelectedNames(null); }} idPrefix="portfolio" testIdPrefix="portfolio" />
      </form>

      <div className="mt-8">
        {m.isPending && <ResultSkeleton />}
        {m.isError && !m.isPending && <ErrorPanel message={errorMessage(m.error)} onRetry={() => run(submitted, submittedAliases, selectedNames ?? undefined)} testId="error-portfolio" />}
        {m.isSuccess && !m.isPending && m.data.selectionRequired && (
          <ApplicantDialog candidates={m.data.applicantCandidates} discovery={m.data.nameDiscovery} selected={selectedNames ?? m.data.applicantCandidates.map((candidate) => candidate.name)}
            onChange={setSelectedNames} onCancel={() => m.reset()} onContinue={() => run(submitted, submittedAliases, selectedNames ?? m.data.applicantCandidates.map((candidate) => candidate.name))} />
        )}
        {m.isSuccess && !m.isPending && !m.data.selectionRequired && <PortfolioResult key={`${m.data.coverage.retrievedAt}:${m.data.matchedApplicantNames.join('|')}`} data={m.data} />}
        {m.isIdle && (
          <EmptyPanel testId="empty-portfolio-idle" title="Enter a company to begin"
            body="You will see identified grants and pending applications, a five-year filing trend, leading technology classes, and recent filings, each with its USPTO source." />
        )}
      </div>
    </div>
  );
}

function ApplicantDialog({ candidates, discovery, selected, onChange, onCancel, onContinue }: {
  candidates: { name: string; count: number }[];
  discovery?: PublicPortfolioAnalysis['nameDiscovery'];
  selected: string[];
  onChange: (names: string[]) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="applicant-dialog-title" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-y-auto rounded-sm border bg-background p-4 shadow-xl sm:p-6" data-testid="dialog-applicant-scope">
      <div className="zk-eyebrow">Confirm portfolio scope</div>
      <h3 id="applicant-dialog-title" className="mt-2 font-display text-2xl font-semibold">Which applicant names should be included?</h3>
      <p className="mt-2 text-sm text-muted-foreground">USPTO records use several potential legal applicant names. All returned names are selected. Clear any that belong to a different or unrelated entity.</p>
      <div className="mt-4"><SelectionControls total={candidates.length} selected={selected.length} onAll={() => onChange(candidates.map((c) => c.name))} onNone={() => onChange([])} testIdPrefix="applicant" /></div>
      <div className="mt-2 max-h-64 min-h-[6rem] space-y-2 overflow-y-auto">
        {candidates.map((candidate, i) => <label key={candidate.name} data-testid={`row-applicant-candidate-${i}`} className="flex cursor-pointer items-start gap-3 border p-3 text-sm hover:bg-muted/50">
          <input type="checkbox" checked={selected.includes(candidate.name)} onChange={(event) => onChange(event.target.checked ? [...selected, candidate.name] : selected.filter((name) => name !== candidate.name))} className="mt-0.5 accent-primary" data-testid={`checkbox-applicant-${i}`} />
          <span className="min-w-0 flex-1"><span className="block break-words font-medium">{candidate.name}</span><span className="text-xs text-muted-foreground">{fmtNum(candidate.count)} matching USPTO records</span></span>
        </label>)}
      </div>
      {selected.length > MAX_APPLICANT_NAMES && <p className="mt-3 text-xs text-destructive" role="alert">Select at most {MAX_APPLICANT_NAMES} applicant names.</p>}
      {discovery && <div className="mt-4"><NameDiscoveryPanel discovery={discovery} testId="panel-name-discovery-select" /></div>}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" className="zk-btn-secondary" onClick={onCancel} data-testid="button-cancel-applicants">Cancel</button>
        <button type="button" className="zk-btn-primary" disabled={!selected.length || selected.length > MAX_APPLICANT_NAMES} onClick={onContinue} data-testid="button-analyze-selected">Analyze selected</button>
      </div>
    </section>
  </div>;
}

function PortfolioResult({ data }: { data: PublicPortfolioAnalysis }) {
  const [selectedTechnology, setSelectedTechnology] = useState<PublicPortfolioAnalysis['topTechnologyAreas'][number] | null>(null);
  const advanced = useAnalyzePublicPortfolioAdvanced();
  const namesKey = data.matchedApplicantNames.slice().sort().join('|');
  useEffect(() => {
    const names = namesKey.split('|').filter(Boolean);
    if (names.length) advanced.mutate({ data: { selectedApplicantNames: names } });
  }, [namesKey]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [second, setSecond] = useState<PublicPortfolioAnalysis | null>(null);
  const secondAdvanced = useAnalyzePublicPortfolioAdvanced();
  const secondAdvancedRef = useRef(secondAdvanced);
  secondAdvancedRef.current = secondAdvanced;
  const secondKey = second ? `${second.coverage.retrievedAt}:${second.matchedApplicantNames.join('|')}` : '';
  useEffect(() => {
    const req = secondAdvancedRef.current;
    req.reset();
    if (second && second.matchedApplicantNames.length) req.mutate({ data: { selectedApplicantNames: second.matchedApplicantNames } });
  }, [secondKey]);
  const primaryAdvanced = advancedFor(advanced, data.matchedApplicantNames);
  const secondAdvancedData = second ? advancedFor(secondAdvanced, second.matchedApplicantNames) : undefined;
  const exitComparison = () => { setSecond(null); };
  const total = data.identifiedGrantedPatents + data.identifiedPendingApplications;
  if (total === 0 && data.recentApplications.length === 0) {
    return <div className="space-y-6">
      <EmptyPanel testId="empty-portfolio-results" title={`No USPTO records matched "${data.companyName}"`}
        body="Try the exact legal entity name as it appears on filings, for example including Inc., LLC, or Corporation, or a known former name." />
      <QuestionsWorthAsking tool="portfolio" />
      <CoverageLedger coverage={data.coverage} testId="coverage-portfolio" />
      <QuestionsContactCTA />
    </div>;
  }
  const waitingForPrimary = data.matchedApplicantNames.length > 0 && !primaryAdvanced && !advanced.isError;
  const waitingForComparison = second && second.matchedApplicantNames.length > 0 && !secondAdvancedData && !secondAdvanced.isError;
  if (waitingForPrimary || waitingForComparison) {
    return <div aria-busy="true" data-testid="portfolio-complete-loading">
      <p role="status" className="mb-4 text-sm text-muted-foreground">
        {second ? 'Preparing both portfolios' : 'Preparing your complete portfolio'} — loading prosecution histories and efficiency metrics. All results will appear together when ready.
      </p>
      <ResultSkeleton />
    </div>;
  }
  const maxTech = Math.max(1, ...data.topTechnologyAreas.map((t) => t.count));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="space-y-8" data-testid="result-portfolio">
      <header>
        <div className="zk-eyebrow">Portfolio snapshot</div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-display text-3xl font-semibold" data-testid="text-portfolio-company">{data.companyName}</h3>
          <div className="flex flex-wrap items-start gap-3">
            {second
              ? <SnapshotPdfChooser options={[
                  { portfolio: data, advanced: primaryAdvanced, advancedPending: advanced.isPending },
                  { portfolio: second, advanced: secondAdvancedData, advancedPending: secondAdvanced.isPending },
                ]} />
              : <PortfolioSnapshotPdfButton portfolio={data} advanced={primaryAdvanced} />}
            <button type="button" onClick={() => setCompareOpen(true)} className="zk-btn-primary inline-flex items-center gap-2 shadow-md ring-1 ring-[hsl(var(--zk-brass)/0.5)]" data-testid="button-compare-company">
              <GitCompareArrows className="h-4 w-4" /> {second ? 'Change comparison company' : 'Compare against another company'}
            </button>
          </div>
        </div>
        {data.matchedApplicantNames.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <MatchedApplicantNames names={data.matchedApplicantNames} />
            {!second && <FirmInvolvementBadge fb={primaryAdvanced?.firmBenchmark} testId="badge-firm-involvement" />}
          </div>
        )}
        {data.nameDiscovery && <div className="mt-3"><NameDiscoveryPanel discovery={data.nameDiscovery} testId="panel-name-discovery-result" /></div>}
      </header>
      <CompareCompanyDialog open={compareOpen} onOpenChange={setCompareOpen} primary={data} onCompare={setSecond} />

      {second ? (
        <PortfolioComparison a={{ data, advanced: primaryAdvanced, request: advanced }} b={{ data: second, advanced: secondAdvancedData, request: secondAdvanced }}
          onReplace={() => setCompareOpen(true)} onExit={exitComparison} />
      ) : <>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metric emphasis label="Granted — status unverified" value={data.identifiedGrantedPatents} note="The USPTO application status does not confirm current in-force status." testId="metric-granted" />
        <Metric label="Identified pending" value={data.identifiedPendingApplications} testId="metric-pending" />
        <Metric label="Expired / inactive identified" value={data.expiredInactivePatents} note="Only explicit inactive status labels are counted." testId="metric-expired" />
        <Metric label="Grants in last 12 months" value={data.recentGrantCount} testId="metric-recent-grants" />
      </div>
      <p className="-mt-5 text-xs text-muted-foreground">Data as of {fmtDate(data.coverage.retrievedAt)}. “Granted” is not an active-patent count.</p>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h4 className="zk-h4">Filing trend, last five years</h4>
          {data.filingTrends.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No filing dates available in the analyzed records.</p> : (
            <FilingTrendChart trends={data.filingTrends} />
          )}
          <p className="mt-3 text-xs text-muted-foreground">Recent years undercount: most applications publish about 18 months after filing.</p>
        </section>
        <section>
          <h4 className="zk-h4">Leading technology areas</h4>
          <p className="mt-1 text-xs text-muted-foreground">Counts are CPC classification occurrences, not unique patents; one application may appear in multiple categories.</p>
          {data.topTechnologyAreas.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Classification data unavailable for these records.</p> : (
            <ul className="mt-4 space-y-3">
              {data.topTechnologyAreas.map((t, i) => (
                <li key={t.code} data-testid={`row-tech-${i}`}>
                  <div className="flex justify-between gap-3 text-sm">
                    <button type="button" onClick={() => setSelectedTechnology(t)} aria-haspopup="dialog" className="text-left hover:text-primary">
                      <span className="font-mono text-xs text-[hsl(var(--zk-brass))] mr-2">{t.code}</span>{t.label}
                      <span className="ml-2 text-xs text-muted-foreground underline underline-offset-2">CPC details</span>
                    </button>
                    <span className="tabular-nums font-medium">{fmtNum(t.count)}</span>
                  </div>
                  <div className="mt-1.5 h-1 bg-muted"><motion.div className="h-full bg-primary origin-left" style={{ width: `${(t.count / maxTech) * 100}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15 + i * 0.06, duration: 0.6 }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AdvancedPortfolioMetrics applicantNames={data.matchedApplicantNames} request={advanced} />

      <RecentPortfolioRecords applications={data.recentApplications} grants={data.recentGrants} />

      {selectedTechnology && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTechnology(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="cpc-details-title" className="w-full max-w-xl rounded-sm border bg-background p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="zk-eyebrow">Cooperative Patent Classification</div>
                <h3 id="cpc-details-title" className="mt-2 font-display text-2xl font-semibold">{selectedTechnology.code} — {selectedTechnology.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">Top CPC codes returned for this section, with their classification-occurrence counts.</p>
              </div>
              <button type="button" aria-label="Close CPC details" onClick={() => setSelectedTechnology(null)} className="rounded-sm p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 max-h-72 overflow-y-auto border-t">
              {selectedTechnology.classifications.length ? (
                <ul className="divide-y">
                  {selectedTechnology.classifications.map((classification) => (
                    <li key={classification.code} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <code className="font-mono text-primary">{classification.code.trim().replace(/\s+/g, ' ')}</code>
                      <span className="tabular-nums text-muted-foreground">{fmtNum(classification.count)} occurrences</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="py-4 text-sm text-muted-foreground">No detailed CPC codes were returned for this group.</p>}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">A CPC code classifies a technical subject area in a patent record. One application can carry multiple codes, so these occurrence counts overlap and should not be summed as unique patents.</p>
          </section>
        </div>
      )}

      <QuestionsWorthAsking tool="portfolio" />
      <CoverageLedger coverage={data.coverage} testId="coverage-portfolio"
        extra={<>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Record limit.</strong> The limit of five applies to recent application detail rows; the portfolio totals and technology aggregates use the full reported match count.</p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Legal status limitation.</strong> USPTO status text reflects prosecution records only. It does not confirm maintenance-fee payment, ownership after assignment, expiration, or enforceability. This is not a legal opinion.</p>
        </>} />
      <QuestionsContactCTA />
      </>}
    </motion.div>
  );
}

function FilingTrendChart({ trends }: { trends: { year: number; count: number }[] }) {
  const axisMax = Math.max(1, ...trends.map((trend) => trend.count));

  return (
    <div className="mt-4 rounded-sm border bg-card/50 px-3 py-4 sm:px-5" data-testid="chart-filing-trends"
      role="img" aria-label={`Applications filed by year: ${trends.map((trend) => `${trend.year}, ${fmtNum(trend.count)}`).join('; ')}`}>
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-2">
        <div className="relative h-48 text-right text-[10px] tabular-nums text-muted-foreground">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ bottom: `calc(${tick * 100}% - 0.4rem)` }}>{fmtNum(Math.round(axisMax * tick))}</span>)}
        </div>
        <div>
          <div className="relative h-48">
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => <div key={tick} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ bottom: `${tick * 100}%` }} />)}
            <div className="absolute inset-0 flex items-end justify-around gap-2">
              {trends.map((trend) => {
                const barHeight = (trend.count / axisMax) * 100;
                return <div key={trend.year} className="relative h-full min-w-0 flex-1">
                  <div title={`${trend.year}: ${fmtNum(trend.count)} applications filed`} className="absolute bottom-0 left-1/2 w-[56%] max-w-16 -translate-x-1/2 rounded-t-sm bg-primary/90 transition-colors hover:bg-[hsl(var(--zk-brass))]" style={{ height: `${barHeight}%` }} />
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold tabular-nums text-foreground" style={{ bottom: `calc(${barHeight}% + 0.35rem)` }}>{fmtNum(trend.count)}</span>
                </div>;
              })}
            </div>
          </div>
          <div className="mt-2 grid text-center text-xs tabular-nums text-muted-foreground" style={{ gridTemplateColumns: `repeat(${trends.length}, minmax(0, 1fr))` }}>
            {trends.map((trend) => <span key={trend.year}>{trend.year}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
