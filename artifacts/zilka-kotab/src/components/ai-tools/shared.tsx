import type { ReactNode } from 'react';
import type { PublicDataCoverage } from '@workspace/api-client-react';
import { AlertTriangle, Database, RotateCcw } from 'lucide-react';

export function fmtDate(value: string | null | undefined) {
  if (!value) return 'Not reported';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

export function errorMessage(err: unknown) {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; data?: unknown; message?: string };
    const d = e.data as { error?: string; message?: string } | null | undefined;
    if (d?.error) return d.error;
    if (d?.message) return d.message;
    if (e.status === 429) return 'Too many requests in a short window. Please wait a minute and try again.';
    if (e.status && e.status >= 500) return 'The USPTO data service did not respond as expected. Please try again shortly.';
  }
  return 'We could not complete this lookup. Please check your input and try again.';
}

export function Metric({ label, value, note, testId, emphasis, className }: { label: string; value: number | string | null; note?: string; testId: string; emphasis?: boolean; className?: string }) {
  const unavailable = value === null;
  return (
    <div className={`zk-metric ${emphasis ? 'zk-metric--em' : ''} ${className ?? ''}`} data-testid={testId}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-medium">{label}</div>
      {unavailable ? (
        <div className="mt-2 font-display text-lg text-muted-foreground/80 italic">Unavailable</div>
      ) : (
        <div className="mt-1 font-display text-3xl md:text-4xl font-semibold tabular-nums text-foreground">{typeof value === 'number' ? fmtNum(value) : value}</div>
      )}
      {note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

export function CoverageLedger({ coverage, extra, testId }: { coverage: PublicDataCoverage; extra?: ReactNode; testId: string }) {
  return (
    <aside className="zk-ledger" data-testid={testId}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--zk-brass))] font-semibold">
        <Database className="h-3.5 w-3.5" /> Source and coverage
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div><dt className="zk-dt">Source</dt><dd className="zk-dd" data-testid={`${testId}-source`}>{coverage.source}</dd></div>
        <div><dt className="zk-dt">Retrieved</dt><dd className="zk-dd">{new Date(coverage.retrievedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
        <div><dt className="zk-dt">Records analyzed</dt><dd className="zk-dd tabular-nums">{fmtNum(coverage.recordsAnalyzed)} of {fmtNum(coverage.totalMatchesReported)}</dd></div>
        <div><dt className="zk-dt">Record cap</dt><dd className="zk-dd tabular-nums">{coverage.resultLimit > 0 ? fmtNum(coverage.resultLimit) : 'No cap on aggregate counts'}</dd></div>
      </dl>
      {coverage.truncated && (
        <div className="mt-4 flex gap-2 rounded-sm border border-[hsl(var(--zk-brass)/0.45)] bg-[hsl(var(--zk-brass)/0.08)] p-3 text-sm" data-testid={`${testId}-truncated`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--zk-brass))]" />
          <span><strong className="font-semibold">Partial result.</strong> USPTO reported more matches than this public tool retrieves. Sample-based metrics are withheld or clearly identified when the analyzed records are incomplete.</span>
        </div>
      )}
      {coverage.note && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{coverage.note}</p>}
      {extra}
    </aside>
  );
}

export function ResultSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Retrieving USPTO records" data-testid="status-loading">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="zk-scan" /> Querying USPTO records. This can take up to twenty seconds.
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="zk-skel h-24" style={{ animationDelay: `${i * 120}ms` }} />)}
      </div>
      <div className="zk-skel h-40" />
      <div className="zk-skel h-28" />
    </div>
  );
}

export function ErrorPanel({ message, onRetry, testId }: { message: string; onRetry: () => void; testId: string }) {
  return (
    <div role="alert" className="flex flex-col gap-4 rounded-sm border border-[hsl(var(--zk-oxblood)/0.3)] bg-[hsl(var(--zk-oxblood)/0.05)] p-6 sm:flex-row sm:items-center" data-testid={testId}>
      <AlertTriangle className="h-6 w-6 shrink-0 text-[hsl(var(--zk-oxblood))]" />
      <div className="flex-1">
        <div className="font-display font-semibold">Lookup did not complete</div>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <button onClick={onRetry} className="zk-btn-ghost" data-testid={`${testId}-retry`}><RotateCcw className="h-4 w-4" /> Try again</button>
    </div>
  );
}

export function EmptyPanel({ title, body, testId }: { title: string; body: string; testId: string }) {
  return (
    <div className="zk-empty" data-testid={testId}>
      <div className="font-display text-xl font-semibold">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
