import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsPDF } from 'jspdf';
import type { PublicExaminerAnalysis } from '@workspace/api-client-react';
import { EXAMINER_SNAPSHOT_QUESTIONS, examinerInterviewComparison, examinerSnapshotTitle } from '../src/components/ai-tools/examiner-snapshot-pdf';

test('all five examiner questions fit on one line in the approved questions section', () => {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
  assert.equal(EXAMINER_SNAPSHOT_QUESTIONS.length, 5);
  for (const question of EXAMINER_SNAPSHOT_QUESTIONS) {
    assert.ok(pdf.getTextWidth(question) <= (881 - 87) * 612 / 934, question);
    assert.ok(question.endsWith('?'));
  }
});

const interview: NonNullable<PublicExaminerAnalysis['interviewAnalytics']> = {
  applicationsWithEventData: 100,
  applicationsWithInterviewSummary: 40,
  interviewSummaryAllowed: 30,
  interviewSummaryAbandoned: 10,
  interviewSummaryOther: 0,
  applicationsWithoutInterviewSummary: 60,
  noSummaryAllowed: 30,
  noSummaryAbandoned: 30,
  noSummaryOther: 0,
};

test('interview comparison reports percentage-point and relative differences separately', () => {
  assert.deepEqual(examinerInterviewComparison(interview), {
    withDisposed: 40, withoutDisposed: 60,
    withRate: 75, withoutRate: 50,
    differencePoints: 25, relativeChange: 50,
  });
});

test('unresolved applications do not lower the disposed-outcome allowance rate', () => {
  const result = examinerInterviewComparison({
    ...interview, applicationsWithInterviewSummary: 55, interviewSummaryOther: 15,
  });
  assert.equal(result.withDisposed, 40);
  assert.equal(result.withRate, 75);
});

test('missing event records produce unavailable rates, not zeroes', () => {
  for (const source of [undefined, { ...interview, applicationsWithEventData: 0 }]) {
    const result = examinerInterviewComparison(source);
    assert.equal(result.withRate, null);
    assert.equal(result.withoutRate, null);
    assert.equal(result.relativeChange, null);
    assert.equal(result.differencePoints, null);
  }
});

test('a cohort without disposed outcomes is not treated as a zero allowance rate', () => {
  const result = examinerInterviewComparison({
    ...interview, interviewSummaryAllowed: 0, interviewSummaryAbandoned: 0, interviewSummaryOther: 40,
  });
  assert.equal(result.withRate, null);
  assert.equal(result.differencePoints, null);
  assert.equal(result.relativeChange, null);
});

test('a zero comparison rate does not create an infinite relative change', () => {
  const result = examinerInterviewComparison({ ...interview, noSummaryAllowed: 0, noSummaryAbandoned: 60 });
  assert.equal(result.withoutRate, 0);
  assert.equal(result.differencePoints, 75);
  assert.equal(result.relativeChange, null);
});

test('an observed negative difference is preserved rather than described as an uplift', () => {
  const result = examinerInterviewComparison({ ...interview, interviewSummaryAllowed: 0, interviewSummaryAbandoned: 40 });
  assert.equal(result.withRate, 0);
  assert.equal(result.differencePoints, -50);
  assert.equal(result.relativeChange, -100);
});

test('examiner and art-unit snapshots use the selected profile identity', () => {
  const data = { searchType: 'examiner', examinerName: 'EXAMPLE, JANE', query: 'Example', artUnit: '2485' } as PublicExaminerAnalysis;
  assert.equal(examinerSnapshotTitle(data), 'EXAMPLE, JANE');
  assert.equal(examinerSnapshotTitle({ ...data, searchType: 'art-unit' }), 'Art Unit 2485');
});
