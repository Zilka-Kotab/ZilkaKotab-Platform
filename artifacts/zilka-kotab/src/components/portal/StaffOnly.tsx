import { ReactNode } from 'react';
import { Link } from 'wouter';
import { ShieldAlert } from 'lucide-react';
import { usePortalAccess } from '@/lib/hooks-portal';

const STAFF = ['ADMIN', 'ATTORNEY', 'PARALEGAL'];

/** Frontend staff-only guard. The backend still enforces access; this keeps client users out of staff screens. */
export function StaffOnly({ children }: { children: ReactNode }) {
  const { data, isLoading } = usePortalAccess();
  if (isLoading) return <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-9"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>;
  if (!STAFF.includes(data?.user?.role ?? '')) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" data-testid="status-staff-only">
        <ShieldAlert className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-3 font-display text-xl font-semibold">Firm staff only</h1>
        <p className="mt-2 text-sm text-muted-foreground">This area is limited to Zilka-Kotab attorneys, paralegals and administrators.</p>
        <Link href="/portal" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Back to Firm Portal</Link>
      </div>
    );
  }
  return <>{children}</>;
}

export const fieldClass = 'h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';
export const errorText = (reason: unknown, fallback: string) => {
  const msg = reason instanceof Error ? reason.message : fallback;
  return /revision|conflict|changed|stale|concurren/i.test(msg) ? `${msg} Someone else saved this record. Refresh and retry; your entries are kept below.` : msg;
};
