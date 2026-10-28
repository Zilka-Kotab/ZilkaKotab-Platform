import assert from 'node:assert/strict';
import { test } from 'node:test';
import { examinerActivitySpan } from '../src/components/ai-tools/examiner-activity';
import type { PublicExaminerAnalysis } from '@workspace/api-client-react';

const sample = (issueDate?: string, retrievedAt = '2026-10-28T12:00:00Z') => ({
  coverage: { retrievedAt },
  roleEvidence: issueDate ? { earliestActivity: { issueDate } } : undefined,
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
