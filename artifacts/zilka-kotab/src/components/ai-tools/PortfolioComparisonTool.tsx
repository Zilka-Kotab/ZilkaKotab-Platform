import { useEffect, useRef } from 'react';
import { useAnalyzePublicPortfolioAdvanced, type PublicPortfolioAnalysis } from '@workspace/api-client-react';
import { PortfolioComparisonSearch } from './PortfolioComparisonSearch';
import { PortfolioComparison } from './PortfolioComparison';
import { PortfolioComparisonPdfButton } from './PortfolioComparisonPdfButton';
import { advancedFor } from './portfolio-compare-utils';
import { ResultSkeleton } from './shared';

export function PortfolioComparisonTool() {
  return <div data-testid="tool-portfolio-comparison">
    <div className="mb-6">
      <h3 className="font-display text-2xl font-semibold">Patent Portfolio Comparison</h3>
      <p className="mt-2 text-sm text-muted-foreground">Compare two companies’ patent portfolios, filing trends, technology areas, and prosecution efficiency.</p>
    </div>
    <PortfolioComparisonSearch renderResult={(primary, second, onExit, onReplace) =>
      <ComparisonResult primary={primary} second={second} onExit={onExit} onReplace={onReplace} />} />
  </div>;
}

function ComparisonResult({ primary, second, onExit, onReplace }: {
  primary: PublicPortfolioAnalysis;
  second: PublicPortfolioAnalysis;
  onExit: () => void;
  onReplace: () => void;
}) {
  const firstRequest = useAnalyzePublicPortfolioAdvanced();
  const secondRequest = useAnalyzePublicPortfolioAdvanced();
  const firstRef = useRef(firstRequest);
  const secondRef = useRef(secondRequest);
  firstRef.current = firstRequest;
  secondRef.current = secondRequest;
  const firstKey = primary.matchedApplicantNames.join('|');
  const secondKey = second.matchedApplicantNames.join('|');

  useEffect(() => {
    if (primary.matchedApplicantNames.length) {
      firstRef.current.mutate({ data: { selectedApplicantNames: primary.matchedApplicantNames } });
    }
  }, [firstKey]);
  useEffect(() => {
    const request = secondRef.current;
    request.reset();
    if (second.matchedApplicantNames.length) {
      request.mutate({ data: { selectedApplicantNames: second.matchedApplicantNames } });
    }
  }, [secondKey]);

  const firstAdvanced = advancedFor(firstRequest, primary.matchedApplicantNames);
  const secondAdvanced = advancedFor(secondRequest, second.matchedApplicantNames);
  const waiting = (
    (!firstAdvanced && !firstRequest.isError) ||
    (!secondAdvanced && !secondRequest.isError)
  );

  return <div className="space-y-6" data-testid="result-portfolio-comparison">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="zk-eyebrow">Portfolio comparison</div>
        <h3 className="mt-1 font-display text-2xl font-semibold" data-testid="text-comparison-title">
          {primary.companyName} vs. {second.companyName}
        </h3>
      </div>
      {!waiting && <PortfolioComparisonPdfButton
        first={{ portfolio: primary, advanced: firstAdvanced }}
        second={{ portfolio: second, advanced: secondAdvanced }}
      />}
    </header>
    {waiting ? <div aria-busy="true" data-testid="portfolio-complete-loading">
      <p role="status" className="mb-4 text-sm text-muted-foreground">Preparing both portfolios — loading prosecution histories and efficiency metrics. All results will appear together when ready.</p>
      <ResultSkeleton />
    </div> : <PortfolioComparison
      a={{ data: primary, advanced: firstAdvanced, request: firstRequest }}
      b={{ data: second, advanced: secondAdvanced, request: secondRequest }}
      onReplace={onReplace}
      onExit={onExit}
    />}
  </div>;
}
