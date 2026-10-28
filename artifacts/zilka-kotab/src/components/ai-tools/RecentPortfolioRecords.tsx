import { useState, type ReactNode } from 'react';
import { ExternalLink, PanelRightOpen } from 'lucide-react';
import type { PublicPatentApplication, PublicPatentGrant } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fmtDate } from './shared';

const PREVIEW = 5;

function SourceLink({ href, label, testId }: { href: string; label: string; testId?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline" data-testid={testId}>
    {label}<ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="sr-only">(opens USPTO record in new tab)</span>
  </a>;
}

function Panel({ title, note, count, empty, onOpen, buttonTestId, emptyTestId, children }: {
  title: string; note: ReactNode; count: number; empty: string; onOpen: () => void; buttonTestId: string; emptyTestId: string; children: ReactNode;
}) {
  return <section className="min-w-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 className="zk-h4">{title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </div>
      <button type="button" onClick={onOpen} disabled={count === 0} aria-haspopup="dialog"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-[hsl(var(--zk-brass)/0.5)] px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-[hsl(var(--zk-brass)/0.1)] disabled:cursor-not-allowed disabled:opacity-40"
        data-testid={buttonTestId} title={count === 0 ? 'No records to show' : undefined}>
        <PanelRightOpen className="h-3.5 w-3.5" /> View details
      </button>
    </div>
    {count === 0
      ? <p className="mt-4 rounded-sm border border-dashed px-3 py-4 text-sm text-muted-foreground" data-testid={emptyTestId}>{empty}</p>
      : <ul className="mt-3 divide-y border-y">{children}</ul>}
  </section>;
}

function Row({ link, title, date, testId }: { link: ReactNode; title: string; date: string; testId: string }) {
  return <li className="py-2.5 transition-colors hover:bg-[hsl(var(--zk-brass)/0.05)]" data-testid={testId}>
    <div className="flex items-baseline justify-between gap-3">
      {link}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{date}</span>
    </div>
    <p className="mt-0.5 truncate text-sm" title={title}>{title}</p>
  </li>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words text-sm">{children}</dd></div>;
}

export function RecentPortfolioRecords({ applications, grants }: { applications: PublicPatentApplication[]; grants: PublicPatentGrant[] }) {
  const [open, setOpen] = useState<'apps' | 'grants' | null>(null);
  return <>
    <div className="grid gap-8 lg:grid-cols-2" data-testid="section-recent-records">
      <Panel title="Recent applications" note={`${applications.length} most recent returned record${applications.length === 1 ? '' : 's'}.`}
        count={applications.length} empty="No recent applications in the analyzed records." onOpen={() => setOpen('apps')}
        buttonTestId="button-details-applications" emptyTestId="empty-recent-applications">
        {applications.slice(0, PREVIEW).map((a) => <Row key={a.applicationNumber} testId={`row-application-${a.applicationNumber}`} title={a.title}
          date={`Filed ${fmtDate(a.filingDate)}`} link={<SourceLink href={a.url} label={a.applicationNumber} testId={`link-application-${a.applicationNumber}`} />} />)}
      </Panel>
      <Panel title="Recent patent grants" note="Last 12 months. Links open the USPTO application record."
        count={grants.length} empty="No recent grants found in this period." onOpen={() => setOpen('grants')}
        buttonTestId="button-details-grants" emptyTestId="empty-recent-grants">
        {grants.slice(0, PREVIEW).map((g) => <Row key={g.patentNumber} testId={`row-grant-${g.patentNumber}`} title={g.title}
          date={`Granted ${fmtDate(g.grantDate)}`} link={<SourceLink href={g.url} label={g.patentNumber} testId={`link-grant-${g.patentNumber}`} />} />)}
      </Panel>
    </div>

    <Dialog open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null); }}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-sm p-0" data-testid="dialog-recent-records">
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <div className="zk-eyebrow">USPTO source records</div>
          <DialogTitle className="font-display text-2xl font-semibold">{open === 'grants' ? 'Recent patent grants' : 'Recent applications'}</DialogTitle>
          <DialogDescription className="text-xs">
            {open === 'grants'
              ? `All ${grants.length} returned grant record${grants.length === 1 ? '' : 's'} from the last 12 months. This is not the complete portfolio.`
              : `All ${applications.length} returned application record${applications.length === 1 ? '' : 's'}. The tool returns only the most recent filings, not the complete portfolio.`}
          </DialogDescription>
        </DialogHeader>
        <ol className="divide-y overflow-y-auto px-6">
          {open === 'apps' && applications.map((a) => <li key={a.applicationNumber} className="py-4" data-testid={`detail-application-${a.applicationNumber}`}>
            <p className="text-sm font-medium leading-snug">{a.title}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <Field label="Application"><SourceLink href={a.url} label={a.applicationNumber} testId={`detail-link-application-${a.applicationNumber}`} /></Field>
              <Field label="Publication"><span className="font-mono text-xs">{a.publicationNumber ?? 'Not reported'}</span></Field>
              <Field label="Filed"><span className="tabular-nums">{fmtDate(a.filingDate)}</span></Field>
              <Field label="USPTO status"><span className="text-muted-foreground">{a.status}</span></Field>
            </dl>
          </li>)}
          {open === 'grants' && grants.map((g) => <li key={g.patentNumber} className="py-4" data-testid={`detail-grant-${g.patentNumber}`}>
            <p className="text-sm font-medium leading-snug">{g.title}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <Field label="Patent"><SourceLink href={g.url} label={g.patentNumber} testId={`detail-link-grant-${g.patentNumber}`} /></Field>
              <Field label="Application"><span className="font-mono text-xs">{g.applicationNumber || 'Not reported'}</span></Field>
              <Field label="Granted"><span className="tabular-nums">{fmtDate(g.grantDate)}</span></Field>
              <Field label="Technology">{g.technologyArea}</Field>
            </dl>
          </li>)}
        </ol>
      </DialogContent>
    </Dialog>
  </>;
}
