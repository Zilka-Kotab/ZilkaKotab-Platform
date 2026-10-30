import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FirmBillingItem } from '@workspace/api-client-react';
import { monthlyTotals, quarterTotals, yearTotals, summaryRows, rawRows, itemsForYear, netCents, dollarsToCents, RAW_HEADERS } from '../src/lib/firm-billing-summary';

const item = (values: Partial<FirmBillingItem>): FirmBillingItem => ({
  publicId: 'test', workflowPublicId: null, prebilledOn: null, completedOn: null, ownerName: 'Test', kind: 'FEE', workDate: '2026-03-31',
  client: 'Client', matter: 'Matter', description: 'Flat fee', amountCents: 100000,
  notes: '', code: '', jurisdiction: '', subjectMatter: '', associate: '', shareBasisPoints: 8000,
  invoiceNumber: '', invoiceDate: null, voided: false, revision: 0, paidCents: 0, payments: [], ...values,
});
test('billables, invoices and cash use distinct calendar dates across quarter boundaries', () => {
  const months = monthlyTotals([item({
    invoiceNumber: 'INV-1', invoiceDate: '2026-04-01', paidCents: 100000,
    payments: [{ publicId: 'p1', amountCents: 40000, receivedOn: '2026-06-30', reference: '' }, { publicId: 'p2', amountCents: 60000, receivedOn: '2026-07-01', reference: '' }],
  })], 2026);
  assert.equal(months[2].feeGrossCents, 100000);
  assert.equal(months[2].feeNetCents, 80000);
  assert.equal(months[2].invoicedCents, 0);
  assert.equal(months[3].invoicedCents, 100000);
  const q = quarterTotals(months);
  assert.equal(q[0].feeGrossCents, 100000);
  assert.equal(q[1].receivedCents, 40000);
  assert.equal(q[2].receivedCents, 60000);
  assert.equal(yearTotals(months).receivedCents, 100000);
});
test('allocated net uses the viewer share while gross and the charge remain singular', () => {
  const allocations = [{ userId: 1, name: 'Owner', role: 'OWNER' as const, amountCents: 10000 }, { userId: 2, name: 'Assignee', role: 'ASSIGNEE' as const, amountCents: 40000 }];
  const personal = item({ allocations, allocatedNetCents: 40000, shareBasisPoints: 1000 });
  assert.equal(netCents(personal), 40000);
  assert.equal(monthlyTotals([personal], 2026)[2].feeGrossCents, 100000);
  assert.equal(monthlyTotals([personal], 2026)[2].feeNetCents, 40000);
  const rows = rawRows([personal]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][RAW_HEADERS.indexOf('OWNER AMOUNT')], 100);
  assert.equal(rows[0][RAW_HEADERS.indexOf('ASSIGNEE AMOUNT')], 400);
  assert.equal(rows[0][RAW_HEADERS.indexOf('FIRM REMAINDER')], 500);
  assert.equal(netCents(item({ allocations, allocatedNetCents: 50000 })), 50000);
});
test('expenses and firm reimbursements are separate from flat-fee earnings', () => {
  const months = monthlyTotals([
    item({ kind: 'EXPENSE', amountCents: 7000 }),
    item({ kind: 'REIMBURSEMENT', amountCents: 3000, paidCents: 3000, payments: [{ publicId: 'p', amountCents: 3000, receivedOn: '2026-03-31', reference: '' }] }),
  ], 2026);
  assert.equal(months[2].feeGrossCents, 0);
  assert.equal(months[2].feeNetCents, 0);
  assert.equal(months[2].expenseCents, 7000);
  assert.equal(months[2].reimbursementCents, 3000);
  assert.equal(months[2].receivedCents, 0);
  assert.equal(months[2].reimbursementReceivedCents, 3000);
});
test('voided items remain in raw audit detail but never contribute to summaries', () => {
  const data = [item({ voided: true, invoiceDate: '2026-03-31', payments: [{ publicId: 'p', amountCents: 1000, receivedOn: '2026-03-31', reference: '' }] })];
  assert.equal(yearTotals(monthlyTotals(data, 2026)).feeGrossCents, 0);
  assert.equal(yearTotals(monthlyTotals(data, 2026)).receivedCents, 0);
  assert.equal(rawRows(data)[0][RAW_HEADERS.indexOf('VOIDED')], 'YES');
});
test('March, June, September and December each have quarter totals in the summary sheet', () => {
  const data = summaryRows([], 2026);
  assert.equal(data.length, 17);
  assert.deepEqual([data[3][0], data[7][0], data[11][0], data[15][0]], ['Q1 2026 total', 'Q2 2026 total', 'Q3 2026 total', 'Q4 2026 total']);
  assert.equal(data[16][0], '2026 total');
});
test('raw export includes prior-year work when a current-year receipt contributes to summary', () => {
  const data = item({ workDate: '2025-12-20', invoiceDate: '2025-12-31', payments: [{ publicId: 'p', amountCents: 1000, receivedOn: '2026-01-01', reference: '' }] });
  assert.equal(itemsForYear([data], 2026).length, 1);
  assert.equal(yearTotals(monthlyTotals([data], 2026)).feeGrossCents, 0);
  assert.equal(yearTotals(monthlyTotals([data], 2026)).receivedCents, 1000);
});
test('raw ledger preserves text, flat-fee units, and the uploaded template columns', () => {
  const raw = rawRows([item({ description: '=1+1', amountCents: 12345 })])[0];
  assert.equal(raw.length, RAW_HEADERS.length);
  assert.equal(raw[8], '=1+1'); // ExcelJS string value, not an Excel formula object.
  assert.equal(raw[10], 123.45);
  assert.equal(raw[11], .8);
  assert.equal(raw[13], 98.76);
  assert.ok(!RAW_HEADERS.some((h: string) => h === 'TIME' || h === 'RATE'));
});
test('money uses integer cents and rounds net shares once per fee', () => {
  assert.equal(dollarsToCents('$1,234.56'), 123456);
  assert.equal(dollarsToCents('0.10'), 10);
  for (const value of ['-5', '1.005', 'oops', '']) assert.equal(dollarsToCents(value), null);
  assert.equal(netCents(item({ amountCents: 101, shareBasisPoints: 3333 })), 34);
  assert.equal(netCents(item({ amountCents: 101, shareBasisPoints: 0 })), 0);
});
test('prebilling survives completion without double counting or shifting its reporting month', () => {
  const active = item({ workflowPublicId: 'row', workDate: '2026-02-01', prebilledOn: '2026-02-01' });
  const completed = { ...active, completedOn: '2026-03-31' };
  assert.deepEqual(monthlyTotals([active], 2026), monthlyTotals([completed], 2026));
  assert.equal(monthlyTotals([completed], 2026)[1].feeGrossCents, 100000);
  assert.equal(monthlyTotals([completed], 2026)[2].feeGrossCents, 0);
  const a = rawRows([active])[0], c = rawRows([completed])[0];
  assert.equal(a[0], '', 'pre-billing is not misrepresented as filing/completion');
  assert.equal(c[0], '2026-03-31');
  assert.equal(c[RAW_HEADERS.indexOf('PRE-BILLED')], 'YES*');
  assert.equal(c[RAW_HEADERS.indexOf('PRE-BILL DATE')], '2026-02-01');
  assert.equal(c[RAW_HEADERS.indexOf('ACTUAL COMPLETION DATE')], '2026-03-31');
  assert.equal(c[RAW_HEADERS.indexOf('BILLING WORK DATE')], '2026-02-01');
  assert.equal(c[7], 'Flat fee*');
});
test('cross-year prebilling is included in the completion-year raw export but not billed twice', () => {
  const completed = item({ workflowPublicId: 'row', workDate: '2025-12-01', prebilledOn: '2025-12-01', completedOn: '2026-02-01' });
  assert.equal(itemsForYear([completed], 2026).length, 1);
  assert.equal(yearTotals(monthlyTotals([completed], 2026)).feeGrossCents, 0);
});
