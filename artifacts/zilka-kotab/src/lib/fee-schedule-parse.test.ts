// Run: node --test src/lib/fee-schedule-parse.test.ts  (Node 22.6+ type stripping)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { classifyRate, gridsToEntries, parseCsv, finalizeEntries, detectHeader } from './fee-schedule-parse.ts';
import { allocate } from './workflow-billing.ts';

test('classifyRate', () => {
  assert.deepEqual(classifyRate('$2,500 '), { rateType: 'FLAT', amountCents: 250000 });
  assert.deepEqual(classifyRate('$0'), { rateType: 'FLAT', amountCents: 0 });
  assert.equal(classifyRate('$80/hour').rateType, 'HOURLY');
  assert.equal(classifyRate('$80/hour').amountCents, null);
  assert.equal(classifyRate('$ As Approved').rateType, 'APPROVAL');
  assert.equal(classifyRate('($ figure )').rateType, 'ADJUSTMENT');
});

test('csv quoted fields', () => {
  const g = parseCsv('Billing Code,Item,Fee\r\n"A1","Item, with ""comma""","$1,000"\nA2,Two,$80/hour\n');
  assert.deepEqual(g[1], ['A1', 'Item, with "comma"', '$1,000']);
  const { entries } = gridsToEntries([g]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].amountCents, 100000);
  assert.throws(() => parseCsv('a,"b\n'));
});

test('ambiguous / missing tables rejected', () => {
  assert.throws(() => gridsToEntries([[['Name:', 'x']]]), /No fee schedule/);
  const t = [['Billing Code', 'Item', 'Fee'], ['A', 'B', '$1']];
  assert.throws(() => gridsToEntries([t, t]), /2 tables/);
  assert.throws(() => detectHeader(['Code', 'Billing Code', 'Item', 'Fee']), /Ambiguous/);
});

test('duplicate codes kept distinct', () => {
  const { entries, warnings } = gridsToEntries([[['Billing Code', 'Item', 'Fee'], ['P', 'one', '$350'], ['P', 'two', '$500']]]);
  assert.equal(entries.length, 2);
  assert.notEqual(entries[0].id, entries[1].id);
  assert.ok(warnings.some((w) => w.includes('P')));
  assert.equal(typeof finalizeEntries(entries), 'object');
});

test('allocation math', () => {
  const a = allocate(100000, { ownerShareBasisPoints: 2500, ownerFixedCents: null, assigneeShareBasisPoints: 1000 });
  assert.deepEqual([a.ownerCents, a.assigneeCents, a.firmCents], [25000, 10000, 65000]);
  const b = allocate(100000, { ownerShareBasisPoints: 0, ownerFixedCents: 95000, assigneeShareBasisPoints: 1000 });
  assert.ok(b.over);
});

// Local sample check: regex table extraction stands in for DOMParser in node.
const sample = new URL('../../../../attached_assets/0_Fee_Agreement_1793332839702.docx', import.meta.url);
test('sample docx', { skip: !existsSync(sample) }, async () => {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(readFileSync(sample));
  const xml = await zip.file('word/document.xml')!.async('string');
  const text = (s: string) => [...s.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  const grids = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map((t) => [...t[1].matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((r) => [...r[0].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((c) => text(c[1]))));
  const { entries, warnings } = gridsToEntries(grids);
  assert.equal(entries.length, 60);
  assert.equal(entries.filter((e) => e.code === 'PAT402').length, 2);
  assert.ok(warnings.some((w) => w.includes('PAT402')));
  assert.equal(entries.find((e) => e.code === 'BAW110')!.rateType, 'HOURLY');
  assert.equal(entries.find((e) => e.code === 'PAT101')!.amountCents, 1100000);
});
