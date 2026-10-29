import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { GitCompareArrows, Search } from 'lucide-react';
import { useAnalyzePublicPortfolio, type PublicPortfolioAnalysis } from '@workspace/api-client-react';
import { ApplicantDialog } from './PortfolioAnalyzer';
import { AliasField, aliasPayload, parseAliases } from './CompanyNameScope';
import { hasRecords, scopeKey } from './portfolio-compare-utils';
import { EmptyPanel, ErrorPanel, ResultSkeleton, errorMessage } from './shared';

export function PortfolioComparisonSearch({ renderResult }: {
  renderResult: (first: PublicPortfolioAnalysis, second: PublicPortfolioAnalysis, reset: () => void, editSecond: () => void) => ReactNode;
}) {
  const [companies, setCompanies] = useState(['', '']);
  const [aliases, setAliases] = useState(['', '']);
  const [selected, setSelected] = useState<(string[] | null)[]>([null, null]);
  const first = useAnalyzePublicPortfolio();
  const second = useAnalyzePublicPortfolio();
  const requests = [first, second];
  const secondInput = useRef<HTMLInputElement>(null);
  const parsed = aliases.map(parseAliases);
  const busy = requests.some((request) => request.isPending);
  const sameInput = companies[0].trim().toLowerCase() === companies[1].trim().toLowerCase();
  const valid = companies.every((name) => name.trim().length >= 2) && parsed.every((p) => !p.error) && !sameInput;
  const ready = requests.map((request) => request.isSuccess && !request.data.selectionRequired && hasRecords(request.data));
  const sameScope = ready.every(Boolean) && scopeKey(first.data!.matchedApplicantNames) === scopeKey(second.data!.matchedApplicantNames);
  const selectionIndex = first.isSuccess && first.data.selectionRequired ? 0
    : ready[0] && second.isSuccess && second.data.selectionRequired ? 1 : null;
  const selectionRequest = selectionIndex === null ? null : requests[selectionIndex];
  const selectionData = selectionRequest?.data;
  const chosen = selectionIndex === null || !selectionData ? [] : selected[selectionIndex] ?? selectionData.applicantCandidates.map((candidate) => candidate.name);

  const reset = () => {
    first.reset();
    second.reset();
    setSelected([null, null]);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || busy) return;
    reset();
    requests.forEach((request, index) => request.mutate({
      data: { companyName: companies[index].trim(), ...aliasPayload(parsed[index].names) },
    }));
  };
  const editSecond = () => {
    secondInput.current?.focus();
    secondInput.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return <div>
    <form onSubmit={submit} className="zk-query" data-testid="form-portfolio-comparison">
      <div className="grid gap-5 sm:grid-cols-2">
        {companies.map((company, index) => {
          const label = index === 0 ? 'First company' : 'Second company';
          const id = index === 0 ? 'comparison-first-company' : 'comparison-second-company';
          return <div className="min-w-0" key={id}>
            <label htmlFor={id} className="zk-query-label">{label}</label>
            <div className="zk-query-row">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input id={id} ref={index === 1 ? secondInput : undefined} value={company} disabled={busy} maxLength={120}
                onChange={(event) => setCompanies((current) => current.map((value, i) => i === index ? event.target.value : value))}
                placeholder={index === 0 ? 'e.g. Microsoft' : 'e.g. Micron'} className="zk-query-input" autoComplete="organization" data-testid={`input-${id}`} />
            </div>
            <AliasField value={aliases[index]} onChange={(value) => setAliases((current) => current.map((text, i) => i === index ? value : text))}
              idPrefix={id} testIdPrefix={id} />
          </div>;
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Enter both companies, then confirm the matching USPTO applicant names for each. Add known DBA or former names separately for each company.</p>
      {sameInput && companies[0].trim().length >= 2 && <p role="alert" className="mt-2 text-sm text-destructive">Enter two different companies.</p>}
      <button type="submit" disabled={!valid || busy} className="zk-btn-primary mt-4" data-testid="button-compare-portfolios">
        <GitCompareArrows className="h-4 w-4" /> {busy ? 'Searching companies…' : 'Compare companies'}
      </button>
    </form>

    <div className="mt-8 space-y-5">
      {busy && <div aria-busy="true"><p role="status" className="mb-3 text-sm text-muted-foreground">Searching both companies’ USPTO records…</p><ResultSkeleton /></div>}
      {requests.map((request, index) => request.isError ? <ErrorPanel key={index} testId={`error-comparison-company-${index}`}
        message={`${index === 0 ? 'First' : 'Second'} company: ${errorMessage(request.error)}`}
        onRetry={() => { if (request.variables) request.mutate(request.variables); }} /> : null)}
      {requests.map((request, index) => request.isSuccess && !request.data.selectionRequired && !hasRecords(request.data)
        ? <EmptyPanel key={index} testId={`empty-comparison-company-${index}`} title={`No USPTO records matched "${request.data.companyName}"`}
          body={`Update the ${index === 0 ? 'first' : 'second'} company name or its DBA names above, then compare again.`} /> : null)}
      {selectionIndex !== null && selectionData && <ApplicantDialog
        title={`${selectionIndex === 0 ? 'First' : 'Second'} company: ${selectionData.companyName}`}
        candidates={selectionData.applicantCandidates} discovery={selectionData.nameDiscovery} selected={chosen}
        onChange={(names) => setSelected((current) => current.map((value, index) => index === selectionIndex ? names : value))}
        onCancel={reset}
        onContinue={() => {
          const request = requests[selectionIndex];
          if (request.variables) request.mutate({ data: { ...request.variables.data, selectedApplicantNames: chosen } });
        }} />}
      {sameScope && <p role="alert" className="rounded-sm border p-4 text-sm" data-testid="error-compare-identical">Both searches resolved to the same applicant scope. Enter a different company and compare again.</p>}
      {ready.every(Boolean) && !sameScope && <div key={`${first.data!.coverage.retrievedAt}:${first.data!.matchedApplicantNames.join('|')}:${second.data!.coverage.retrievedAt}:${second.data!.matchedApplicantNames.join('|')}`}>
        {renderResult(first.data!, second.data!, reset, editSecond)}
      </div>}
      {requests.every((request) => request.isIdle) && <EmptyPanel testId="empty-comparison-idle" title="Enter two companies to begin"
        body="Compare patent portfolios and prosecution efficiency side by side, using each company's confirmed USPTO applicant scope." />}
    </div>
  </div>;
}
