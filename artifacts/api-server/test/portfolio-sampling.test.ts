import { test } from "node:test";
import assert from "node:assert/strict";
import { portfolioSamplePages } from "../src/lib/portfolio-sampling";
import { metricApplication, calculatePortfolioMetrics } from "../src/lib/portfolio-metrics";

test("small portfolios are retrieved completely, including non-round final pages", () => {
  for (const total of [0, 1, 13, 99, 101, 1575, 1999, 2000]) {
    const pages = portfolioSamplePages(total);
    const indices = pages.flatMap(p => Array.from({ length: p.limit }, (_, i) => p.offset + i));
    assert.equal(indices.length, total);
    assert.deepEqual(indices, Array.from({ length: total }, (_, i) => i));
  }
});
test("large portfolios use the same 20-request budget across the entire result range without overlap", () => {
  for (const total of [2001, 21498, 100000]) {
    const pages = portfolioSamplePages(total);
    assert.equal(pages.length, 20);
    assert.equal(pages.reduce((n, p) => n + p.limit, 0), 2000);
    assert.ok(pages[19].offset > total * .9);
    const indices = pages.flatMap(p => Array.from({ length: p.limit }, (_, i) => p.offset + i));
    assert.equal(new Set(indices).size, 2000);
    assert.ok(indices.every(i => i >= 0 && i < total));
    assert.deepEqual(pages, portfolioSamplePages(total));
  }
});
test("a recent-only zero-OA subset cannot dominate the historical portfolio sample", () => {
  const total = 20000;
  const recordAt = (i: number) => metricApplication({
    applicationNumberText: `APP-${i}`,
    applicationMetaData: {
      filingDate: i < 2000 ? "2025-06-01" : "2020-06-01",
      patentNumber: i < 21 || i >= 2000 ? `PAT-${i}` : undefined,
      applicationStatusDescriptionText: i < 21 || i >= 2000 ? "Patented Case" : "Docketed",
    },
    eventDataBag: i < 2000 ? [{ eventCode: "FILE" }] : [{ eventCode: "CTNF" }, { eventCode: "CTFR" }],
  });
  const newest = Array.from({ length: 2000 }, (_, i) => recordAt(i));
  assert.equal(calculatePortfolioMetrics(newest).officeActionsPerPatent.value, 0);
  const distributed = portfolioSamplePages(total).flatMap(p => Array.from({ length: p.limit }, (_, i) => recordAt(p.offset + i)));
  const metrics = calculatePortfolioMetrics(distributed);
  assert.ok(metrics.officeActionsPerPatent.value! > 0);
  assert.ok(metrics.officeActionsPerPatent.denominator > 1000);
});
test("invalid sample sizes are rejected", () => {
  assert.throws(() => portfolioSamplePages(-1));
  assert.throws(() => portfolioSamplePages(100, 0));
});
