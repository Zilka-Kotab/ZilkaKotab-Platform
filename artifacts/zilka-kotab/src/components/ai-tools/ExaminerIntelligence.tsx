import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import { useAnalyzePublicExaminer } from '@workspace/api-client-react';
import type { PublicExaminerAnalysis } from '@workspace/api-client-react';
import { CoverageLedger, EmptyPanel, ErrorPanel, Metric, ResultSkeleton, errorMessage, fmtNum } from './shared';
import { ExaminerSnapshotPdfButton } from './ExaminerSnapshotPdfButton';
import { ExaminerProsecutionBehavior } from './ExaminerProsecutionBehavior';
import { ExaminerGuidance } from './ExaminerGuidance';
import { examinerActivitySpan } from './examiner-activity';
import { QuestionsWorthAsking, QuestionsContactCTA } from './QuestionsWorthAsking';

export function ExaminerIntelligence() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const m = useAnalyzePublicExaminer();
  const q = query.trim();
  const valid = q.length >= 2;
  const looksArtUnit = /^\d{4}$/.test(q);
  const looksApplicationNumber = /^\d{2}\/?\d{6}$/.test(q.replace(/[\s,.-]/g, ''));

  const run = (v: string, name?: string) => { setSubmitted(v); m.mutate({ data: { query: v, ...(name ? { selectedExaminerName: name } : {}) } }); };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (valid && !m.isPending) run(q); };

  return (
    <div>
      <form onSubmit={onSubmit} className="zk-query">
        <label htmlFor="examiner-query" className="zk-query-label">Examiner name, art unit, or application number</label>
        <div className="zk-query-row">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input id="examiner-query" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100}
            placeholder="e.g. 2128 or Smith, Jane" className="zk-query-input" data-testid="input-examiner-query" />
          {valid && <span className="hidden sm:inline zk-chip" data-testid="text-query-type">{looksApplicationNumber ? 'Application' : looksArtUnit ? 'Art unit' : 'Examiner'}</span>}
          <button type="submit" disabled={!valid || m.isPending} className="zk-btn-primary" data-testid="button-analyze-examiner">
            {m.isPending ? 'Analyzing' : 'Analyze'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Enter an examiner name, a four-digit art unit, or an 8-digit USPTO application number.</p>
      </form>

      <div className="mt-8">
        {m.isPending && <ResultSkeleton />}
        {m.isError && !m.isPending && <ErrorPanel message={errorMessage(m.error)} onRetry={() => run(submitted)} testId="error-examiner" />}
        {m.isSuccess && !m.isPending && m.data.selectionRequired && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="examiner-dialog-title" className="w-full max-w-lg rounded-sm border bg-background p-6 shadow-xl">
              <div className="zk-eyebrow">Choose examiner</div>
              <h3 id="examiner-dialog-title" className="mt-2 font-display text-2xl font-semibold">Which examiner did you mean?</h3>
              <p className="mt-2 text-sm text-muted-foreground">Several USPTO examiner names matched this search. Counts beside names are from the returned sample.</p>
              <div className="mt-5 max-h-64 space-y-2 overflow-y-auto">
                {m.data.examinerCandidates.map((candidate) => <button key={candidate.examinerName} type="button" className="flex w-full justify-between gap-4 border p-3 text-left text-sm hover:bg-muted/50" onClick={() => run(submitted, candidate.examinerName)}>
                  <span>{candidate.examinerName}</span><span className="shrink-0 text-muted-foreground">{fmtNum(candidate.count)} sample matches</span>
                </button>)}
              </div>
              <div className="mt-5 flex justify-end"><button type="button" className="zk-btn-secondary" onClick={() => m.reset()}>Cancel</button></div>
            </section>
          </div>
        )}
        {m.isSuccess && !m.isPending && !m.data.selectionRequired && <ExaminerResult data={m.data} />}
        {m.isIdle && (
          <EmptyPanel testId="empty-examiner-idle" title="Look up an examiner or art unit"
            body="See disposed, allowed, and abandoned counts, an estimated allowance rate where the record supports one, and the examiners most active in an art unit." />
        )}
      </div>
    </div>
  );
}

function ExaminerResult({ data }: { data: PublicExaminerAnalysis }) {
  if (data.identifiedApplications === 0) {
    return <div className="space-y-6">
      <EmptyPanel testId="empty-examiner-results" title={`No applications found for "${data.query}"`}
        body={data.searchType === 'art-unit' ? 'Confirm the art unit number. Some art units have been renumbered or retired.' : 'Try last name only, or the format LAST, FIRST as printed on office actions.'} />
      <QuestionsWorthAsking tool="examiner" />
      <CoverageLedger coverage={data.coverage} testId="coverage-examiner" />
      <QuestionsContactCTA />
    </div>;
  }
  const rate = data.estimatedAllowanceRate;
  const maxEx = Math.max(1, ...data.topExaminers.map((e) => e.count));
  const title = data.searchType === 'art-unit' ? `Art Unit ${data.artUnit ?? data.query}` : (data.examinerName ?? data.query);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="space-y-8" data-testid="result-examiner">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="zk-eyebrow">{data.searchType === 'art-unit' ? 'Art unit profile' : 'Examiner profile'}</div>
            <h3 className="mt-1 font-display text-3xl font-semibold" data-testid="text-examiner-title">{title}</h3>
          </div>
          <ExaminerSnapshotPdfButton data={data} />
        </div>
        {data.applicationNumberContext && <p className="mt-2 text-sm text-muted-foreground">Profile opened from application <span className="font-mono">{data.applicationNumberContext}</span>. The profile reflects the examiner currently listed; earlier prosecution may have involved another examiner.</p>}
        <ExaminerGuidance data={data} />
        {data.artUnit && data.allowanceBenchmarks && (
          <section className="mt-5 border-l-4 border-[hsl(var(--zk-brass))] bg-muted/50 p-4 sm:p-5" data-testid="art-unit-overview">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{data.searchType === 'art-unit' ? 'Art unit' : 'Most common art unit'}</div>
                <div className="mt-1 font-display text-4xl font-semibold text-primary">{data.artUnit}</div>
              </div>
              <div className="min-w-0 flex-1 sm:border-l sm:pl-5">
                <div className="text-sm font-medium">Technology Center {data.allowanceBenchmarks.technologyCenter ?? 'not identified'}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">An art unit is a USPTO examination group organized within a technology center. This record set contains {fmtNum(data.allowanceBenchmarks.artUnitApplications)} applications for the art unit and {fmtNum(data.allowanceBenchmarks.artUnitDisposedApplications)} with allowed or abandoned outcomes.</p>
              </div>
            </div>
          </section>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="zk-dial" data-testid="metric-allowance-rate">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-medium">Estimated allowance rate</div>
          {rate === null ? (
            <div className="mt-6 font-display text-xl italic text-muted-foreground">Unavailable</div>
          ) : (
            <div className="relative mx-auto mt-4 h-40 w-40">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <motion.circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="butt"
                  strokeDasharray={2 * Math.PI * 52} initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - rate / 100) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-display text-4xl font-semibold tabular-nums">{rate.toFixed(1)}<span className="text-lg text-muted-foreground">%</span></div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Allowed divided by disposed (allowed plus abandoned) in the analyzed sample.</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border bg-border md:grid-cols-3">
          <Metric label="Identified" value={data.identifiedApplications} testId="metric-identified" />
          <Metric label="Allowed" value={data.allowedApplications} testId="metric-allowed" />
          {data.searchType === 'examiner' && <Metric label="Examiner Role"
            value={data.roleEvidence?.role === 'primary' ? 'Primary' : data.roleEvidence?.role === 'assistant' ? 'Supervised' : null}
            testId="metric-examiner-role" className="md:col-start-3 md:row-start-1" />}
          <Metric label="Abandoned" value={data.abandonedApplications} testId="metric-abandoned" />
          <Metric label="Avg. prosecution, months" value={data.averageProsecutionDurationMonths === null ? null : data.averageProsecutionDurationMonths.toFixed(1)} testId="metric-duration" />
          {data.searchType === 'examiner' && <Metric label="Years of Activity"
            value={examinerActivitySpan(data)}
            testId="metric-examiner-years" className="md:col-start-3 md:row-start-2" />}
        </div>
      </div>

      {data.topExaminers.length > 0 && (
        <section>
          <h4 className="zk-h4">{data.searchType === 'art-unit' ? 'Most active examiners in this art unit' : 'Matching examiners'}</h4>
          <ul className="mt-4 space-y-2.5">
            {data.topExaminers.map((e, i) => (
              <li key={e.examinerName} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-4 text-sm" data-testid={`row-examiner-${i}`}>
                <span className="truncate">{e.examinerName}</span>
                <div className="h-1.5 bg-muted"><motion.div className="h-full bg-[hsl(var(--zk-brass))] origin-left" style={{ width: `${(e.count / maxEx) * 100}%` }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }} /></div>
                <span className="tabular-nums font-medium">{fmtNum(e.count)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.allowanceBenchmarks && (
        <section data-testid="section-allowance-benchmarks">
          <h4 className="zk-h4">{data.searchType === 'examiner' ? 'Examiner vs. Art Unit' : 'Art Unit vs. Technology Center'}</h4>
          <p className="mt-1 text-xs text-muted-foreground">Allowance rate is allowed ÷ (allowed + abandoned); pending cases are excluded.</p>
          <div className="mt-4 space-y-4">
            {[
              ...(data.searchType === 'examiner' ? [{ label: 'Examiner', value: data.allowanceBenchmarks.examinerAllowanceRate, emphasis: true, n: data.disposedApplications }] : []),
              { label: `Art Unit ${data.allowanceBenchmarks.artUnit ?? '—'}`, value: data.allowanceBenchmarks.artUnitAllowanceRate, emphasis: false, n: data.allowanceBenchmarks.artUnitDisposedApplications },
              { label: `Technology Center ${data.allowanceBenchmarks.technologyCenter ?? '—'}`, value: data.allowanceBenchmarks.technologyCenterAllowanceRate, emphasis: false, n: data.allowanceBenchmarks.technologyCenterDisposedApplications },
            ].map((row) => (
              <div key={row.label} className="grid grid-cols-[7.5rem_minmax(0,1fr)_6rem] items-center gap-2 text-xs sm:grid-cols-[9rem_minmax(0,1fr)_7rem] sm:gap-3 sm:text-sm">
                <span className={row.emphasis ? 'font-semibold' : 'text-muted-foreground'}>{row.label}</span>
                <div className="h-2 bg-muted" aria-hidden="true">
                  {row.value !== null && <div className={`h-full ${row.emphasis ? 'bg-primary' : 'bg-[hsl(var(--zk-brass))]'}`} style={{ width: `${row.value}%` }} />}
                </div>
                <span className="text-right tabular-nums">{row.value === null ? 'Unavailable' : `${row.value.toFixed(1)}%`}<span className="ml-1 text-xs text-muted-foreground">n={fmtNum(row.n)}</span></span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{data.allowanceBenchmarks.calculationNote}</p>
        </section>
      )}

      <ExaminerProsecutionBehavior data={data} />

      <QuestionsWorthAsking tool="examiner" />
      <CoverageLedger coverage={data.coverage} testId="coverage-examiner"
        extra={<>
          {data.searchType === 'examiner' && <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>Examiner Role reflects the dated public document, not necessarily the examiner’s current role. “Supervised” denotes a documented assistant examiner. Years of Activity is a lower-bound span between verified dated examiner roles, not years employed or continuous service. A separate historical grant search checks beyond the current docket; earlier activity and gaps may exist. Unsupported spans are withheld. Filing dates and unassigned transaction dates are not attributed to the examiner.</p>
            <p>{data.roleEvidence?.note}</p>
            <details className="border-t pt-3">
              <summary className="cursor-pointer font-medium text-foreground">Historical evidence and confidence</summary>
              <div className="mt-3 space-y-2">
                <p>Source: {data.roleEvidence?.history?.source ?? 'USPTO ODP grant XML'}. Observed-activity confidence: {data.roleEvidence?.history?.confidence ?? 'low'}; complete career coverage is not established.</p>
                <p>{data.roleEvidence?.history?.confidenceNote}</p>
                <p>Earliest grant verified in checked records: {data.roleEvidence?.earliestActivity?.issueDate ?? 'Not established'}. Earliest primary record in checked records: {data.roleEvidence?.history?.earliestPrimary?.issueDate ?? 'Not established'}; this is not a promotion date.</p>
                <p>Distinct applications with a named grant role in checked sample: {data.roleEvidence?.history?.distinctApplicationsVerified ?? 'Not verified'}. Total historically examined: {data.roleEvidence?.history?.totalHistoricallyExamined ?? 'Unavailable — historical coverage incomplete'}. Current assignments are not career examination counts.</p>
                <p>Assistant-to-primary sequence: {data.roleEvidence?.history?.transitionStatus === 'observed_sequence'
                  ? `Assistant record ${data.roleEvidence.history.earliestAssistant?.issueDate}; primary record ${data.roleEvidence.history.earliestPrimary?.issueDate}. These observations do not establish a promotion date.`
                  : 'Not established. Missing assistant records do not prove the examiner was never an assistant.'}</p>
                <p>{data.roleEvidence?.history?.note ?? 'Historical datasets have not been indexed. No reliable career-wide estimate is available.'}</p>
                {data.roleEvidence?.history?.evidence.map(item => <div key={`${item.applicationNumber}-${item.role}`}>
                  <a className="underline underline-offset-2" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.patentNumber}</a>
                  {' · '}{item.issueDate}{' · '}{item.role} examiner{' · Application '}{item.applicationNumber}
                </div>)}
              </div>
            </details>
          </div>}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><strong className="font-semibold text-foreground">How this is calculated.</strong> {data.calculationNote}</p>
        </>} />
      <QuestionsContactCTA />
    </motion.div>
  );
}
