import type { PublicFirmBenchmark, PublicFirmBenchmarkLinesItem, PublicFirmBenchmarkLinesItemMetric } from '@workspace/api-client-react';
import { fmtNum } from './shared';

export const FIRM_DISCLOSURE = 'N is the analyzed application sample. Association is based on current USPTO correspondence data and does not establish that all historical prosecution work was handled by Zilka-Kotab.';

export function benchmarkValue(line: PublicFirmBenchmarkLinesItem) {
  if (line.unit === 'percent') return `${line.value.toFixed(1)}%`;
  if (line.unit === 'years') return `${line.value.toFixed(1)} yrs`;
  return line.value.toFixed(1);
}

/** Only server-returned qualifying lines; never synthesizes a benchmark. */
export function findLine(fb: PublicFirmBenchmark | undefined, metric: PublicFirmBenchmarkLinesItemMetric) {
  return fb?.lines.find((line) => line.metric === metric && Number.isFinite(line.value) && line.denominator > 0);
}

export const hasLines = (fb: PublicFirmBenchmark | undefined) => !!fb && fb.lines.some((l) => Number.isFinite(l.value) && l.denominator > 0);
export const involvementText = (fb: PublicFirmBenchmark) => `${fmtNum(fb.excludedApplications)} of ${fmtNum(fb.companyApplications)} applications prosecuted by Zilka-Kotab`;

export function FirmBenchmarkLine({ fb, metric, testId, align = 'left' }: { fb: PublicFirmBenchmark | undefined; metric: PublicFirmBenchmarkLinesItemMetric; testId: string; align?: 'left' | 'center' | 'right' }) {
  const line = findLine(fb, metric);
  if (!line) return null;
  return (
    <p className={`mt-2 rounded-sm border border-[hsl(var(--zk-brass)/0.75)] bg-[hsl(var(--zk-brass)/0.08)] px-2.5 py-2 font-sans text-[11px] leading-snug text-primary ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`} data-testid={testId}>
      <span className="font-semibold text-[hsl(var(--zk-brass))]">Zilka-Kotab:</span>{' '}
      <span className="font-semibold tabular-nums">{benchmarkValue(line)}</span>
      <span className="text-muted-foreground"> — matched to this portfolio's technology mix (n={fmtNum(line.denominator)})</span>
    </p>
  );
}

export function FirmInvolvementBadge({ fb, testId }: { fb: PublicFirmBenchmark | undefined; testId: string }) {
  if (!fb || fb.excludedApplications <= 0) return null;
  return (
    <span className="inline-flex flex-col gap-0.5 border-l-2 border-[hsl(var(--zk-brass))] bg-[hsl(var(--zk-brass)/0.08)] px-2.5 py-1.5 text-xs" data-testid={testId}>
      <strong className="font-semibold text-primary">{involvementText(fb)}</strong>
      <span className="text-[11px] leading-snug text-muted-foreground">{FIRM_DISCLOSURE}</span>
    </span>
  );
}
