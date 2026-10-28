import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PublicPortfolioAnalysis, useAnalyzePublicPortfolioAdvanced } from '@workspace/api-client-react';
import { advancedFor, hasRecords, scopeKey } from '../src/components/ai-tools/portfolio-compare-utils';

type Request = ReturnType<typeof useAnalyzePublicPortfolioAdvanced>;

test('comparison scope matching ignores order, case and surrounding whitespace', () => {
  assert.equal(scopeKey(['Example LLC', ' Another Inc. ']), scopeKey(['another inc.', 'EXAMPLE LLC']));
  assert.notEqual(scopeKey(['Example LLC']), scopeKey(['Example LLC', 'Example Subsidiary']));
});

test('advanced results are never exported for a different company or partial applicant scope', () => {
  const data = { marker: 'first-company' };
  const request = {
    isSuccess: true, data, variables: { data: { selectedApplicantNames: ['First Inc.'] } },
  } as unknown as Request;
  assert.equal(advancedFor(request, ['FIRST INC.']), data);
  assert.equal(advancedFor(request, ['Second Inc.']), undefined);
  assert.equal(advancedFor(request, ['First Inc.', 'First Subsidiary']), undefined);
  assert.equal(advancedFor({ ...request, isSuccess: false } as Request, ['First Inc.']), undefined);
  assert.equal(advancedFor({ ...request, variables: undefined } as Request, ['First Inc.']), undefined);
});

test('empty searches cannot activate comparison but pending-only portfolios can', () => {
  const empty = { identifiedGrantedPatents: 0, identifiedPendingApplications: 0, recentApplications: [] } as unknown as PublicPortfolioAnalysis;
  assert.equal(hasRecords(empty), false);
  assert.equal(hasRecords({ ...empty, identifiedPendingApplications: 3 }), true);
  assert.equal(hasRecords({ ...empty, identifiedGrantedPatents: 5 }), true);
});
