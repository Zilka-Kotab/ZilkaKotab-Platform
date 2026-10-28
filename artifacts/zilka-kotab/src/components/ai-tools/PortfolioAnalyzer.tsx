import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink, Search, X } from 'lucide-react';
import { useAnalyzePublicPortfolio } from '@workspace/api-client-react';
import type { PublicPortfolioAnalysis } from '@workspace/api-client-react';
import { AdvancedPortfolioMetrics } from './AdvancedPortfolioMetrics';
import { CoverageLedger, EmptyPanel, ErrorPanel, Metric, ResultSkeleton, errorMessage, fmtDate, fmtNum } from './shared';

export function PortfolioAnalyzer() {
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const m = useAnalyzePublicPortfolio();
  const valid = company.trim().length >= 2;

  const run = (name: string, names?: string[]) => {
    setSubmitted(name);
    setSelectedNames(names ?? []);
    m.mutate({ data: { companyName: name, ...(names ? { selectedApplicantNames: names } : {}) } });
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (valid && !m.isPending) run(company.trim()); };

  return (
    <div>
      <form onSubmit={onSubmit} className="zk-query">
        <label htmlFor="portfolio-company" className="zk-query-label">Company or assignee name</label>
        <div className="zk-query-row">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input id="portfolio-company" value={company} onChange={(e) => { setCompany(e.target.value); setSelectedNames([]); }} maxLength={120}
            placeholder="e.g. Rambus Inc." className="zk-query-input" autoComplete="organization" data-testid="input-portfolio-company" />
          <button type="submit" disabled={!valid || m.isPending} className="zk-btn-primary" data-testid="button-analyze-portfolio">
            {m.isPending ? 'Analyzing' : 'Analyze portfolio'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Searches public USPTO application data by applicant name. Name variants and subsidiaries may need separate searches.</p>
      </form>

      <div className="mt-8">
        {m.isPending && <ResultSkeleton />}
        {m.isError && !m.isPending && <ErrorPanel message={errorMessage(m.error)} onRetry={() => run(submitted)} testId="error-portfolio" />}
        {m.isSuccess && !m.isPending && m.data.selectionRequired && (
          <ApplicantDialog candidates={m.data.applicantCandidates} selected={selectedNames.length ? selectedNames : m.data.applicantCandidates.map((candidate) => candidate.name)}
            onChange={setSelectedNames} onCancel={() => m.reset()} onContinue={() => run(submitted, selectedNames.length ? selectedNames : m.data.applicantCandidates.map((candidate) => candidate.name))} />
        )}
        {m.isSuccess && !m.isPending && !m.data.selectionRequired && <PortfolioResult data={m.data} />}
        {m.isIdle && (
          <EmptyPanel testId="empty-portfolio-idle" title="Enter a company to begin"
            body="You will see identified grants and pending applications, a five-year filing trend, leading technology classes, and recent filings, each with its USPTO source." />
        )}
      </div>
    </div>
  );
}

function ApplicantDialog({ candidates, selected, onChange, onCancel, onContinue }: {
  candidates: { name: string; count: number }[];
  selected: string[];
  onChange: (names: string[]) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="applicant-dialog-title" className="w-full max-w-lg rounded-sm border bg-background p-6 shadow-xl">
      <div className="zk-eyebrow">Confirm portfolio scope</div>
      <h3 id="applicant-dialog-title" className="mt-2 font-display text-2xl font-semibold">Which applicant names should be included?</h3>
      <p className="mt-2 text-sm text-muted-foreground">USPTO records use several potential legal applicant names. Select all that belong in this portfolio.</p>
      <div className="mt-5 max-h-64 space-y-2 overflow-y-auto">
        {candidates.map((candidate) => <label key={candidate.name} className="flex cursor-pointer items-start gap-3 border p-3 text-sm hover:bg-muted/50">
          <input type="checkbox" checked={selected.includes(candidate.name)} onChange={(event) => onChange(event.target.checked ? [...selected, candidate.name] : selected.filter((name) => name !== candidate.name))} className="mt-0.5 accent-primary" />
          <span className="min-w-0 flex-1"><span className="block font-medium">{candidate.name}</span><span className="text-xs text-muted-foreground">{fmtNum(candidate.count)} matching USPTO records</span></span>
        </label>)}
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="zk-btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="zk-btn-primary" disabled={!selected.length} onClick={onContinue}>Analyze selected</button>
      </div>
    </section>
  </div>;
}

function PortfolioResult({ data }: { data: PublicPortfolioAnalysis }) {
  const [showMoreGrants, setShowMoreGrants] = useState(false);
  const [selectedTechnology, setSelectedTechnology] = useState<PublicPortfolioAnalysis['topTechnologyAreas'][number] | null>(null);
  const total = data.identifiedGrantedPatents + data.identifiedPendingApplications;
  if (total === 0 && data.recentApplications.length === 0) {
    return <div className="space-y-6">
      <EmptyPanel testId="empty-portfolio-results" title={`No USPTO records matched "${data.companyName}"`}
        body="Try the exact legal entity name as it appears on filings, for example including Inc., LLC, or Corporation, or a known former name." />
      <CoverageLedger coverage={data.coverage} testId="coverage-portfolio" />
    </div>;
  }
  const maxTech = Math.max(1, ...data.topTechnologyAreas.map((t) => t.count));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="space-y-8" data-testid="result-portfolio">
      <header>
        <div className="zk-eyebrow">Portfolio snapshot</div>
        <h3 className="mt-1 font-display text-3xl font-semibold" data-testid="text-portfolio-company">{data.companyName}</h3>
        {data.matchedApplicantNames.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Matched applicant names:</span>
            {data.matchedApplicantNames.map((n, i) => <span key={n} className="zk-chip" data-testid={`text-applicant-${i}`}>{n}</span>)}
          </div>
        )}
      </header>

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

      <AdvancedPortfolioMetrics applicantNames={data.matchedApplicantNames} portfolio={data} />

      <section>
        <h4 className="zk-h4">Recent applications</h4>
        {data.recentApplications.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No recent applications in the analyzed records.</p> : (
          <div className="mt-3 overflow-x-auto border rounded-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Application</th><th className="px-4 py-2.5 font-medium">Title</th><th className="px-4 py-2.5 font-medium">Filed</th><th className="px-4 py-2.5 font-medium">USPTO status</th></tr>
              </thead>
              <tbody>
                {data.recentApplications.map((a) => (
                  <tr key={a.applicationNumber} className="border-t transition-colors hover:bg-[hsl(var(--zk-brass)/0.06)]" data-testid={`row-application-${a.applicationNumber}`}>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid={`link-application-${a.applicationNumber}`}>{a.applicationNumber}<ExternalLink className="h-3 w-3" /></a>
                      {a.publicationNumber && <div className="mt-0.5 text-muted-foreground">{a.publicationNumber}</div>}
                    </td>
                    <td className="px-4 py-3">{a.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{fmtDate(a.filingDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="zk-h4">Recent Patent Grants</h4>
            <p className="mt-1 text-xs text-muted-foreground">Most recent grants in the last 12 months. Links open the corresponding USPTO application record.</p>
          </div>
          {data.recentGrants.length > 5 && (
            <button type="button" className="text-sm text-primary underline underline-offset-4" onClick={() => setShowMoreGrants((value) => !value)}>
              {showMoreGrants ? 'Show fewer' : 'View more'}
            </button>
          )}
        </div>
        {data.recentGrants.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No recent grants found in this period.</p> : (
          <div className="mt-3 overflow-x-auto rounded-sm border">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted/60 text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Patent number</th><th className="px-4 py-2.5 font-medium">Title</th><th className="px-4 py-2.5 font-medium">Grant date</th><th className="px-4 py-2.5 font-medium">Technology category</th></tr>
              </thead>
              <tbody>{data.recentGrants.slice(0, showMoreGrants ? 20 : 5).map((grant) => (
                <tr key={grant.patentNumber} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs"><a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{grant.patentNumber}<ExternalLink className="ml-1 inline h-3 w-3" /></a></td>
                  <td className="px-4 py-3">{grant.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{fmtDate(grant.grantDate)}</td>
                  <td className="px-4 py-3">{grant.technologyArea}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

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

      <CoverageLedger coverage={data.coverage} testId="coverage-portfolio"
        extra={<>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Record limit.</strong> The limit of five applies to recent application detail rows; the portfolio totals and technology aggregates use the full reported match count.</p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Legal status limitation.</strong> USPTO status text reflects prosecution records only. It does not confirm maintenance-fee payment, ownership after assignment, expiration, or enforceability. This is not a legal opinion.</p>
        </>} />
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
