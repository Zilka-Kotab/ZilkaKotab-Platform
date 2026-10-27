import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ExternalLink, Search } from 'lucide-react';
import { useAnalyzePublicPortfolio } from '@workspace/api-client-react';
import type { PublicPortfolioAnalysis } from '@workspace/api-client-react';
import { CoverageLedger, EmptyPanel, ErrorPanel, Metric, ResultSkeleton, errorMessage, fmtDate, fmtNum } from './shared';

export function PortfolioAnalyzer() {
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState('');
  const m = useAnalyzePublicPortfolio();
  const valid = company.trim().length >= 2;

  const run = (name: string) => {
    setSubmitted(name);
    m.mutate({ data: { companyName: name } });
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (valid && !m.isPending) run(company.trim()); };

  return (
    <div>
      <form onSubmit={onSubmit} className="zk-query">
        <label htmlFor="portfolio-company" className="zk-query-label">Company or assignee name</label>
        <div className="zk-query-row">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input id="portfolio-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120}
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
        {m.isSuccess && !m.isPending && <PortfolioResult data={m.data} />}
        {m.isIdle && (
          <EmptyPanel testId="empty-portfolio-idle" title="Enter a company to begin"
            body="You will see identified grants and pending applications, a five-year filing trend, leading technology classes, and recent filings, each with its USPTO source." />
        )}
      </div>
    </div>
  );
}

function PortfolioResult({ data }: { data: PublicPortfolioAnalysis }) {
  const total = data.identifiedGrantedPatents + data.identifiedPendingApplications;
  if (total === 0 && data.recentApplications.length === 0) {
    return <div className="space-y-6">
      <EmptyPanel testId="empty-portfolio-results" title={`No USPTO records matched "${data.companyName}"`}
        body="Try the exact legal entity name as it appears on filings, for example including Inc., LLC, or Corporation, or a known former name." />
      <CoverageLedger coverage={data.coverage} testId="coverage-portfolio" />
    </div>;
  }
  const maxTrend = Math.max(1, ...data.filingTrends.map((t) => t.count));
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

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-3">
        <Metric emphasis label="Identified granted" value={data.identifiedGrantedPatents} testId="metric-granted" />
        <Metric label="Identified pending" value={data.identifiedPendingApplications} testId="metric-pending" />
        <Metric label="Active patents" value={data.activePatentCount} note={data.activePatentCountNote} testId="metric-active" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h4 className="zk-h4">Filing trend, last five years</h4>
          {data.filingTrends.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No filing dates available in the analyzed records.</p> : (
            <div className="mt-4 flex h-44 items-end gap-3" data-testid="chart-filing-trends">
              {data.filingTrends.map((t, i) => (
                <div key={t.year} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs tabular-nums font-medium">{fmtNum(t.count)}</span>
                  <motion.div className="zk-bar w-full origin-bottom" style={{ height: `${Math.max(3, (t.count / maxTrend) * 100)}%` }}
                    initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: 0.1 + i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                  <span className="text-xs text-muted-foreground tabular-nums">{t.year}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Recent years undercount: most applications publish about 18 months after filing.</p>
        </section>
        <section>
          <h4 className="zk-h4">Leading technology areas</h4>
          {data.topTechnologyAreas.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Classification data unavailable for these records.</p> : (
            <ul className="mt-4 space-y-3">
              {data.topTechnologyAreas.map((t, i) => (
                <li key={t.code} data-testid={`row-tech-${i}`}>
                  <div className="flex justify-between gap-3 text-sm"><span><span className="font-mono text-xs text-[hsl(var(--zk-brass))] mr-2">{t.code}</span>{t.label}</span><span className="tabular-nums font-medium">{fmtNum(t.count)}</span></div>
                  <div className="mt-1.5 h-1 bg-muted"><motion.div className="h-full bg-primary origin-left" style={{ width: `${(t.count / maxTech) * 100}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.15 + i * 0.06, duration: 0.6 }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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

      <CoverageLedger coverage={data.coverage} testId="coverage-portfolio"
        extra={<p className="mt-3 text-xs leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">Legal status limitation.</strong> USPTO status text reflects prosecution records only. It does not confirm maintenance-fee payment, ownership after assignment, expiration, or enforceability. This is not a legal opinion.</p>} />
    </motion.div>
  );
}
