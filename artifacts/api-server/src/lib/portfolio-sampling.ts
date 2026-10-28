/** Equal-sized rank strata; take a centered block from each, not just the newest page.
 * This is a systematic block sample, not a random sample or a statistical guarantee.
 * Small portfolios are retrieved completely. The same request budget is retained.
 */
export function portfolioSamplePages(total: number, cap = 2000, pageSize = 100) {
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(cap) || cap < 1 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error("Invalid portfolio sampling parameters");
  const target = Math.min(total, cap);
  const pages = Math.ceil(target / pageSize);
  return Array.from({ length: pages }, (_, i) => {
    const start = Math.floor(i * total / pages);
    const end = Math.floor((i + 1) * total / pages);
    const limit = Math.floor((i + 1) * target / pages) - Math.floor(i * target / pages);
    return { offset: start + Math.floor((end - start - limit) / 2), limit };
  });
}
