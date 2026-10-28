import { calculatePortfolioMetrics, type BenchmarkMetric, type MetricApplication } from "./portfolio-metrics";
export const FIRM_CUSTOMER_NUMBERS = [75359, 96502, 98055, 98995, 109294, 114837, 117970, 127404, 128828, 142083, 146287, 28875, 135841, 149225, 188803, 197438] as const;
export const FIRM_BENCHMARK_FOOTNOTE = "Zilka-Kotab figures: USPTO ODP, applications under the firm's correspondence customer numbers, same filing window and formulas, weighted to this portfolio's technology-center mix.";
const normalizeApplicant = (name: string) => name.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const rules: { metric: BenchmarkMetric; margin: number; higher: boolean; unit: "percent" | "count" | "years" }[] = [
  { metric: "allowanceRate", margin: 2, higher: true, unit: "percent" },
  { metric: "allowedWithTwoActionsRate", margin: 2, higher: true, unit: "percent" },
  { metric: "officeActionsPerPatent", margin: .2, higher: false, unit: "count" },
  { metric: "rceRate", margin: 2, higher: false, unit: "percent" },
  { metric: "timeToGrantYears", margin: .1, higher: false, unit: "years" },
];
export function computeFirmBenchmark(company: MetricApplication[], firm: MetricApplication[], updatedAt: string | null, applicantNames: string[]) {
  const current = company.filter(r => r.customerNumbers.some(n => (FIRM_CUSTOMER_NUMBERS as readonly number[]).includes(n)));
  const result = {
    lines: [] as { metric: BenchmarkMetric; value: number; unit: "percent" | "count" | "years"; denominator: number; companyDenominator: number; coverage: number }[],
    excludedApplications: current.length, companyApplications: company.length, datasetUpdatedAt: updatedAt,
    filingDateStart: null as string | null, filingDateEnd: null as string | null,
    footnote: FIRM_BENCHMARK_FOOTNOTE,
  };
  if (!updatedAt || !company.length || company.some(r => !r.filingDate)) return result;
  const dates = company.map(r => r.filingDate!).sort();
  result.filingDateStart = dates[0]; result.filingDateEnd = dates.at(-1)!;
  const scope = new Set(company.map(r => r.applicationNumber));
  const names = new Set(applicantNames.map(normalizeApplicant));
  const candidates = firm.filter(r => r.category === "REGULAR" && r.filingDate && r.filingDate >= dates[0] && r.filingDate <= dates.at(-1)!
    && !scope.has(r.applicationNumber) && !names.has(normalizeApplicant(r.applicant)));
  const mix = new Map<string, number>();
  for (const r of company) if (r.technologyCenter) mix.set(r.technologyCenter, (mix.get(r.technologyCenter) ?? 0) + 1);
  const companyMetrics = calculatePortfolioMetrics(company);
  for (const rule of rules) {
    const target = companyMetrics[rule.metric];
    if (target.value === null || target.denominator < 10) continue;
    let covered = 0, weighted = 0, n = 0;
    for (const [tc, count] of mix) {
      const metric = calculatePortfolioMetrics(candidates.filter(r => r.technologyCenter === tc))[rule.metric];
      if (metric.value === null || metric.denominator < 10) continue;
      covered += count; weighted += metric.value * count; n += metric.denominator;
    }
    const coverage = covered / company.length;
    if (coverage < .6 || !covered) continue;
    const value = weighted / covered;
    const difference = rule.higher ? value - target.value : target.value - value;
    if (difference + 1e-9 < rule.margin) continue;
    result.lines.push({ metric: rule.metric, value: Math.round(value * 100) / 100, unit: rule.unit,
      denominator: n, companyDenominator: target.denominator, coverage });
  }
  return result;
}
