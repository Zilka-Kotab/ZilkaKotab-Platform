import { useState, type FormEvent } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useAnalyzePublicPortfolio, type PublicPortfolioAnalysis } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { errorMessage, fmtNum } from './shared';
import { hasRecords, scopeKey } from './portfolio-compare-utils';
import { AliasField, NameDiscoveryPanel, SelectionControls, aliasPayload, parseAliases, MAX_APPLICANT_NAMES } from './CompanyNameScope';

export function CompareCompanyDialog({ open, onOpenChange, primary, onCompare }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primary: PublicPortfolioAnalysis;
  onCompare: (data: PublicPortfolioAnalysis) => void;
}) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<{ name: string; aliases: string[]; names?: string[] } | null>(null);
  const [aliasText, setAliasText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const m = useAnalyzePublicPortfolio();
  const aliases = parseAliases(aliasText);
  const valid = query.trim().length >= 2 && !aliases.error;
  const pn = primary.matchedApplicantNames;

  const close = (next: boolean) => {
    if (!next) { m.reset(); setSelected([]); setSubmitted(null); }
    onOpenChange(next);
  };
  const run = (name: string, aliasNames: string[], names?: string[]) => {
    setSubmitted({ name, aliases: aliasNames, names });
    m.mutate({ data: { companyName: name, ...aliasPayload(aliasNames), ...(names ? { selectedApplicantNames: names } : {}) } }, {
      onSuccess: (data) => {
        if (data.selectionRequired || !hasRecords(data)) return;
        if (scopeKey(data.matchedApplicantNames) === scopeKey(primary.matchedApplicantNames)) return;
        onCompare(data);
        close(false);
      },
    });
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (valid && !m.isPending) { setSelected([]); run(query.trim(), aliases.names); } };

  const d = m.data;
  const identical = d && !d.selectionRequired && hasRecords(d) && scopeKey(d.matchedApplicantNames) === scopeKey(primary.matchedApplicantNames);
  const selectionIdentical = d?.selectionRequired && selected.length > 0 && scopeKey(selected) === scopeKey(primary.matchedApplicantNames);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-xl overflow-y-auto rounded-sm p-4 sm:rounded-sm sm:p-6" data-testid="dialog-compare-company">
        <div>
          <div className="zk-eyebrow">Portfolio comparison</div>
          <DialogTitle className="mt-2 font-display text-2xl font-semibold leading-tight">Compare against another company</DialogTitle>
          <DialogDescription className="mt-2">Search for a second company to compare with <strong className="text-foreground">{primary.companyName}</strong>. Its selected applicant scope stays unchanged.</DialogDescription>
          <p className="mt-2 break-words text-xs text-muted-foreground" data-testid="text-compare-primary-scope">Current scope: {pn.length} applicant name{pn.length === 1 ? '' : 's'}{pn.length ? ' (' + pn.slice(0, 3).join('; ') + (pn.length > 3 ? '; …' : '') + ')' : ''}.</p>
        </div>
        <form onSubmit={onSubmit}>
          <label htmlFor="compare-company" className="zk-query-label">Second company or assignee name</label>
          <div className="zk-query-row">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input id="compare-company" autoFocus value={query} maxLength={120} onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Micron Technology, Inc." className="zk-query-input" autoComplete="organization" data-testid="input-compare-company" />
            <button type="submit" disabled={!valid || m.isPending} className="zk-btn-primary" data-testid="button-search-compare">
              {m.isPending ? 'Searching' : 'Search'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {!valid && query.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Enter at least two characters.</p>}
          <AliasField value={aliasText} onChange={setAliasText} idPrefix="compare" testIdPrefix="compare" />
        </form>

        <div aria-live="polite" className="min-h-[3rem]">
          {m.isPending && <div className="space-y-2" data-testid="status-compare-loading"><div className="h-4 w-2/3 animate-pulse bg-muted" /><div className="h-16 animate-pulse bg-muted" /></div>}
          {m.isError && !m.isPending && (
            <div className="border border-destructive/40 p-4 text-sm" role="alert" data-testid="error-compare">
              <p className="font-medium">The search could not be completed.</p>
              <p className="mt-1 text-muted-foreground">{errorMessage(m.error)}</p>
              {submitted && <button type="button" className="mt-2 text-primary underline underline-offset-4" onClick={() => run(submitted.name, submitted.aliases, submitted.names)} data-testid="button-retry-compare">Retry search</button>}
            </div>
          )}
          {d && !m.isPending && !d.selectionRequired && !hasRecords(d) && (
            <div className="border p-4 text-sm" data-testid="empty-compare">
              <p className="font-medium">No USPTO records matched "{d.companyName}".</p>
              <p className="mt-1 text-muted-foreground">Try the exact legal entity name, including Inc., LLC or Corporation.</p>
            </div>
          )}
          {identical && !m.isPending && (
            <div className="border p-4 text-sm" role="alert" data-testid="error-compare-identical">
              <p className="font-medium">That search resolves to the same applicant names as the current result.</p>
              <p className="mt-1 text-muted-foreground">Search for a different company to compare.</p>
            </div>
          )}
          {d?.selectionRequired && !m.isPending && (
            <div data-testid="select-compare-applicants">
              <p className="text-sm font-medium">Several USPTO applicant names match. Select the ones that belong to this company.</p>
              <p className="mt-1 text-xs text-muted-foreground">Nothing is included until you choose it. Similar names may belong to unrelated entities.</p>
              <div className="mt-3"><SelectionControls total={d.applicantCandidates.length} selected={selected.length} onAll={() => setSelected(d.applicantCandidates.map((c) => c.name))} onNone={() => setSelected([])} testIdPrefix="compare" /></div>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                {d.applicantCandidates.map((c, i) => (
                  <label key={c.name} className="flex cursor-pointer items-start gap-3 border p-3 text-sm hover:bg-muted/50">
                    <input type="checkbox" className="mt-0.5 accent-primary" checked={selected.includes(c.name)} data-testid={`checkbox-compare-applicant-${i}`}
                      onChange={(e) => setSelected(e.target.checked ? [...selected, c.name] : selected.filter((n) => n !== c.name))} />
                    <span className="min-w-0 flex-1"><span className="block break-words font-medium">{c.name}</span><span className="text-xs text-muted-foreground">{fmtNum(c.count)} matching USPTO records</span></span>
                  </label>
                ))}
              </div>
              {selected.length > MAX_APPLICANT_NAMES && <p className="mt-2 text-xs text-destructive" role="alert">Select at most {MAX_APPLICANT_NAMES} applicant names.</p>}
              {d.nameDiscovery && <div className="mt-3"><NameDiscoveryPanel discovery={d.nameDiscovery} testId="panel-name-discovery-compare" /></div>}
              {selectionIdentical && <p className="mt-2 text-xs text-destructive" role="alert">This selection is identical to the current result's applicant scope.</p>}
              <div className="mt-4 flex justify-end">
                <button type="button" className="zk-btn-primary" disabled={!selected.length || !!selectionIdentical || selected.length > MAX_APPLICANT_NAMES}
                  onClick={() => run(submitted?.name ?? d.companyName, submitted?.aliases ?? [], selected)} data-testid="button-compare-selected">Compare selected</button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t pt-4">
          <button type="button" className="zk-btn-secondary" onClick={() => close(false)} data-testid="button-cancel-compare">Cancel</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
