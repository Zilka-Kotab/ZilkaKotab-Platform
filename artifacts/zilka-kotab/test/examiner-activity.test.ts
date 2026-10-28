import assert from 'node:assert/strict';
import { test } from 'node:test';
import { examinerActivitySpan } from '../src/components/ai-tools/examiner-activity';
import type { PublicExaminerAnalysis } from '@workspace/api-client-react';

const sample = (issueDate?: string, retrievedAt = '2026-10-28T12:00:00Z') => ({
  coverage: { retrievedAt },
  roleEvidence: issueDate ? { earliestActivity: { issueDate }, history: {
    coverageStatus: 'historical', confidence: 'high', yearsObserved: 100,
  } } : undefined,
}) as PublicExaminerAnalysis;

test('documented span uses the verified grant date and retrieval date, rounded down', () => {
  assert.equal(examinerActivitySpan(sample('2011-10-25')), '15.0 years');
  assert.equal(examinerActivitySpan(sample('2011-11-25')), '14.9 years');
  assert.equal(examinerActivitySpan(sample('2026-10-27')), 'Less than 1 year');
});

test('missing evidence, invalid dates and future records do not manufacture an experience value', () => {
  assert.equal(examinerActivitySpan(sample()), null);
  assert.equal(examinerActivitySpan(sample('2026-02-30')), null);
  assert.equal(examinerActivitySpan(sample('2027-10-27')), null);
  assert.equal(examinerActivitySpan(sample('2011-10-25', 'invalid')), null);
});

test('the limited six-grant sample cannot be presented as examiner experience', () => {
  const limited = sample('2026-10-27');
  limited.roleEvidence!.history!.coverageStatus = 'sampled';
  limited.roleEvidence!.history!.confidence = 'low';
  limited.roleEvidence!.history!.yearsObserved = null;
  assert.equal(examinerActivitySpan(limited), null);
  delete limited.roleEvidence!.history;
  assert.equal(examinerActivitySpan(limited), null, 'legacy cached sample evidence is also withheld');
});

test('corroborated historical dates display an evidence-backed lower bound, not a hire-date estimate', () => {
  const historical = sample('2008-05-20');
  const history = historical.roleEvidence!.history!;
  history.confidence = 'medium';
  history.yearsObserved = 18.4;
  history.evidence = [
    { applicationNumber: '1', patentNumber: 'US1', issueDate: '2008-05-20', role: 'assistant', sourceUrl: 'https://uspto.gov/1' },
    { applicationNumber: '2', patentNumber: 'US2', issueDate: '2026-10-20', role: 'primary', sourceUrl: 'https://uspto.gov/2' },
  ];
  assert.equal(examinerActivitySpan(historical), '18+ years');
  history.yearsObserved = 100;
  assert.equal(examinerActivitySpan(historical), '18+ years', 'years cannot exceed the verified dated span');
  history.evidence = history.evidence.slice(0, 1);
  assert.equal(examinerActivitySpan(historical), null);
});
