import { useId, useState } from 'react';
import { ChevronDown, ExternalLink, Info } from 'lucide-react';
import type { PublicCompanyNameDiscovery } from '@workspace/api-client-react';
import { fmtDate } from './shared';

export const MAX_ALIASES = 50;
export const MAX_APPLICANT_NAMES = 500;

/** Split on newlines or semicolons only — legal names contain commas. Trim + case-insensitive dedup. */
export function parseAliases(text: string): { names: string[]; error: string | null } {
  const seen = new Set<string>();
  const names: string[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/[\n;]+/)) {
    const n = raw.trim().replace(/\s+/g, ' ');
    if (!n) continue;
    if (n.length < 2 || n.length > 200) { bad.push(n.length > 30 ? `${n.slice(0, 30)}…` : n); continue; }
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    names.push(n);
  }
  let error: string | null = null;
  if (bad.length) error = `Each name must be 2 to 200 characters. Check: ${bad.slice(0, 3).join('; ')}${bad.length > 3 ? '…' : ''}`;
  else if (names.length > MAX_ALIASES) error = `Enter at most ${MAX_ALIASES} additional names (you have ${names.length}).`;
  return { names, error };
}

export function aliasPayload(names: string[]) {
  return names.length ? { additionalCompanyNames: names } : {};
}

export function AliasField({ value, onChange, idPrefix, testIdPrefix }: {
  value: string; onChange: (v: string) => void; idPrefix: string; testIdPrefix: string;
}) {
  const [open, setOpen] = useState(value.trim().length > 0);
  const { names, error } = parseAliases(value);
  const id = `${idPrefix}-aliases`;
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline" data-testid={`button-toggle-${testIdPrefix}-aliases`}>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        DBA, former or other company names{names.length ? ` (${names.length})` : ' (optional)'}
      </button>
      {open && (
        <div className="mt-2">
          <label htmlFor={id} className="sr-only">DBA, former or other company names</label>
          <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error} aria-describedby={`${id}-help`}
            placeholder={'One name per line or separated by semicolons\ne.g. Rambus Delaware LLC'}
            className="w-full rounded-sm border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" data-testid={`input-${testIdPrefix}-aliases`} />
          <p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">
            Commas are kept as part of a name. Up to {MAX_ALIASES} names, 2–200 characters each. These are searched as additional potential applicant names; you confirm which to include.
          </p>
          {error && <p className="mt-1 text-xs text-destructive" role="alert" data-testid={`error-${testIdPrefix}-aliases`}>{error}</p>}
        </div>
      )}
    </div>
  );
}

export function SelectionControls({ total, selected, onAll, onNone, testIdPrefix }: {
  total: number; selected: number; onAll: () => void; onNone: () => void; testIdPrefix: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground" data-testid={`text-${testIdPrefix}-selected-count`}>{selected} of {total} selected</span>
      <span className="flex gap-3">
        <button type="button" className="text-primary underline underline-offset-4 disabled:opacity-50" disabled={selected === total} onClick={onAll} data-testid={`button-${testIdPrefix}-select-all`}>Select all</button>
        <button type="button" className="text-primary underline underline-offset-4 disabled:opacity-50" disabled={selected === 0} onClick={onNone} data-testid={`button-${testIdPrefix}-clear-all`}>Clear all</button>
      </span>
    </div>
  );
}

export function NameDiscoveryPanel({ discovery, testId, defaultOpen = false }: {
  discovery?: PublicCompanyNameDiscovery; testId: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const pid = useId();
  if (!discovery) return null;
  const { searchedNames, sources, warnings } = discovery;
  return (
    <div className="rounded-sm border border-[hsl(var(--zk-brass)/0.4)] bg-muted/30 text-xs" data-testid={testId}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={pid}
        className="flex w-full items-center justify-between gap-2 p-3 text-left font-medium" data-testid={`button-toggle-${testId}`}>
        <span className="inline-flex items-center gap-2"><Info className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--zk-brass))]" />
          Name discovery: {searchedNames.length} name{searchedNames.length === 1 ? '' : 's'} searched, {sources.length} source{sources.length === 1 ? '' : 's'}{warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={pid} className="space-y-3 border-t px-3 pb-3 pt-2">
          <p className="leading-relaxed text-muted-foreground">These are suggested potential applicant names, not a verified DBA registry, and not exhaustive. Related companies or subsidiaries are not necessarily the same entity — confirm the scope yourself.</p>
          {searchedNames.length > 0 && <div>
            <div className="font-semibold text-foreground">Names searched</div>
            <div className="mt-1 flex flex-wrap gap-1.5">{searchedNames.map((n, i) => <span key={`${n}-${i}`} className="zk-chip break-all" data-testid={`text-${testId}-searched-${i}`}>{n}</span>)}</div>
          </div>}
          {sources.length > 0 && <div>
            <div className="font-semibold text-foreground">Sources</div>
            <ul className="mt-1 space-y-2">{sources.map((s, i) => (
              <li key={`${s.url}-${i}`} data-testid={`row-${testId}-source-${i}`}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-2 break-all" data-testid={`link-${testId}-source-${i}`}>{s.label}<ExternalLink className="h-3 w-3 shrink-0" /></a>
                <span className="text-muted-foreground"> · retrieved {fmtDate(s.retrievedAt)}</span>
                {s.names.length > 0 && <div className="mt-0.5 text-muted-foreground break-words">{s.names.join('; ')}</div>}
              </li>))}
            </ul>
          </div>}
          {warnings.length > 0 && <div role="note">
            <div className="font-semibold text-foreground">Warnings</div>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">{warnings.map((w, i) => <li key={i} data-testid={`text-${testId}-warning-${i}`}>{w}</li>)}</ul>
          </div>}
        </div>
      )}
    </div>
  );
}
