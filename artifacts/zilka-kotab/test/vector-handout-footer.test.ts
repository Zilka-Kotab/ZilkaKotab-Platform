import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { finishSnapshotWithVectorFooter } from '../src/components/ai-tools/vector-handout-footer';
import { EXAMINER_QUESTIONS } from '../src/components/ai-tools/snapshot-questions';
import { createPortfolioSnapshotBlob } from '../src/components/ai-tools/portfolio-snapshot-pdf';
import type { PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';

test('portfolio and examiner handouts use the same one-page native vector footer', async () => {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const uri = String(input);
    assert.ok(uri.endsWith('firm-handout-footer.pdf'));
    const bytes = await readFile(fileURLToPath(uri));
    return new Response(new Uint8Array(bytes), { status: 200 });
  };
  try {
    const outputDirectory = fileURLToPath(new URL('../../../generated-artifacts/', import.meta.url));
    await mkdir(outputDirectory, { recursive: true });
    for (const [kind, questions] of [['portfolio', undefined], ['examiner', EXAMINER_QUESTIONS]] as const) {
      const source = new jsPDF({ unit: 'pt', format: 'letter' });
      source.text(`Sample ${kind} metrics`, 36, 80);
      const blob = await finishSnapshotWithVectorFooter(source, questions);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const document = await PDFDocument.load(bytes);
      assert.equal(document.getPageCount(), 1);
      assert.deepEqual(document.getPage(0).getSize(), { width: 612, height: 792 });
      await writeFile(`${outputDirectory}/${kind}-vector-footer-check.pdf`, bytes);
    }
    const portfolio = {
      companyName: 'Rambus',
      matchedApplicantNames: ['Rambus Inc.'],
      identifiedGrantedPatents: 1654,
      identifiedPendingApplications: 171,
      expiredInactivePatents: null,
      recentGrantCount: 0,
      filingTrends: [],
      topTechnologyAreas: [],
      recentApplications: [],
      recentGrants: [],
      coverage: { retrievedAt: '2026-10-28T18:00:00Z', recordsAnalyzed: 1877, totalMatchesReported: 1877 },
    } as unknown as PublicPortfolioAnalysis;
    const companyBlob = await createPortfolioSnapshotBlob(portfolio, undefined);
    const companyBytes = new Uint8Array(await companyBlob.arrayBuffer());
    assert.equal((await PDFDocument.load(companyBytes)).getPageCount(), 1);
    await writeFile(`${outputDirectory}/rambus-comparison-corrected.pdf`, companyBytes);
    const advanced = {
      prosecutionEfficiency: {
        averageOfficeActionsPerGrantedPatent: 2.3, officeActionDenominator: 100, rceRate: 40, rceDenominator: 200,
        examinerInterviewRate: 10, interviewDenominator: 200, allowedWithTwoOrFewerActionsRate: 45, allowedWithHistory: 120,
        filingDateStart: '2020-01-01', filingDateEnd: '2026-01-01',
      },
      portfolioInsights: {
        overallAllowanceRate: 75, knownFinalOutcomes: 150, averageTimeToGrantMonths: 37,
        grantDurationSampleSize: 100, averagePendingAgeYears: 2.5, pendingAgeSampleSize: 50,
      },
      coverage: { recordsAnalyzed: 200, truncated: false },
      firmBenchmark: {
        lines: [
          { metric: 'officeActionsPerPatent', value: 1.4, unit: 'count', denominator: 212, companyDenominator: 100, coverage: 0.8 },
          { metric: 'rceRate', value: 20, unit: 'percent', denominator: 212, companyDenominator: 200, coverage: 0.8 },
          { metric: 'allowedWithTwoActionsRate', value: 60, unit: 'percent', denominator: 212, companyDenominator: 120, coverage: 0.8 },
          { metric: 'allowanceRate', value: 85, unit: 'percent', denominator: 212, companyDenominator: 150, coverage: 0.8 },
          { metric: 'timeToGrantYears', value: 2.2, unit: 'years', denominator: 212, companyDenominator: 100, coverage: 0.8 },
        ],
        excludedApplications: 4, companyApplications: 200, datasetUpdatedAt: '2026-10-28T18:00:00Z',
        filingDateStart: '2020-01-01', filingDateEnd: '2026-01-01',
        footnote: "Zilka-Kotab figures: USPTO ODP, applications under the firm's correspondence customer numbers, same filing window and formulas, weighted to this portfolio's technology-center mix.",
      },
    } as unknown as PublicPortfolioAdvancedAnalysis;
    const benchmarkBytes = new Uint8Array(await (await createPortfolioSnapshotBlob(portfolio, advanced)).arrayBuffer());
    assert.equal((await PDFDocument.load(benchmarkBytes)).getPageCount(), 1);
    await writeFile(`${outputDirectory}/portfolio-with-benchmarks-check.pdf`, benchmarkBytes);
  } finally {
    globalThis.fetch = fetchBefore;
  }
});
