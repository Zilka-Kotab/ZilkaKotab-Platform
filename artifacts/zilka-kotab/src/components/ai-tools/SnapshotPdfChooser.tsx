import { useState } from 'react';
import { Download } from 'lucide-react';
import type { PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { downloadPortfolioSnapshot } from './PortfolioSnapshotPdfButton';

type Option = { portfolio: PublicPortfolioAnalysis; advanced?: PublicPortfolioAdvancedAnalysis; advancedPending: boolean };

export function SnapshotPdfChooser({ options }: { options: Option[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  const download = async (i: number) => {
    const o = options[i];
    setBusy(i); setError('');
    try { await downloadPortfolioSnapshot(o.portfolio, o.advanced); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The PDF could not be created.'); }
    finally { setBusy(null); }
  };

  return <>
    <button type="button" onClick={() => { setError(''); setOpen(true); }} className="zk-btn-primary inline-flex items-center gap-2 shadow-md ring-1 ring-[hsl(var(--zk-brass)/0.5)]" data-testid="button-export-pdf">
      <Download className="h-4 w-4" /> Download snapshot PDF
    </button>
    <Dialog open={open} onOpenChange={(o) => { if (busy === null) setOpen(o); }}>
      <DialogContent className="max-w-md rounded-sm sm:rounded-sm" data-testid="dialog-choose-snapshot">
        <div>
          <div className="zk-eyebrow">Individual snapshot</div>
          <DialogTitle className="mt-2 font-display text-2xl font-semibold leading-tight">Which company's snapshot?</DialogTitle>
          <DialogDescription className="mt-2">Each PDF covers one company only, with its own advanced prosecution data.</DialogDescription>
        </div>
        <div className="space-y-2">
          {options.map((o, i) => (
            <button key={i} type="button" disabled={busy !== null} onClick={() => download(i)} data-testid={`button-snapshot-company-${i}`}
              className="flex w-full items-center justify-between gap-3 border p-4 text-left transition-colors hover:border-primary hover:bg-[hsl(var(--zk-brass)/0.06)] disabled:opacity-60">
              <span className="min-w-0">
                <span className="block font-medium">{o.portfolio.companyName}</span>
                <span className="text-xs text-muted-foreground">{o.advanced ? 'Includes advanced metrics' : o.advancedPending ? 'Advanced metrics still loading; PDF will omit them' : 'Advanced metrics unavailable; PDF will omit them'}</span>
              </span>
              <span className="shrink-0 text-sm text-primary">{busy === i ? 'Preparing...' : 'Download'}</span>
            </button>
          ))}
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end"><button type="button" className="zk-btn-secondary" disabled={busy !== null} onClick={() => setOpen(false)} data-testid="button-cancel-snapshot">Cancel</button></div>
      </DialogContent>
    </Dialog>
  </>;
}
