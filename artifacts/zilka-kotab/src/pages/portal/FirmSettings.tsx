import { SEO } from '@/components/SEO';
import { StaffOnly } from '@/components/portal/StaffOnly';
import { DashboardTabs } from '@/components/portal/DashboardTabs';
import { FeeScheduleImport } from '@/components/portal/settings/FeeScheduleImport';
import { AddPortalUser } from '@/components/portal/AddPortalUser';
import { usePortalAccess } from '@/lib/hooks-portal';
import { useFirmOperations } from '@/lib/hooks-firm-operations';
import InternalWorkflowOperations from './InternalWorkflowOperations';

export default function FirmSettings() {
  return <StaffOnly><DashboardTabs /><SettingsPage /></StaffOnly>;
}

function SettingsPage() {
  const user = usePortalAccess().data?.user;
  const ops = useFirmOperations();
  const staff = ops.data?.staff ?? [];
  return (
    <div className="py-6">
      <SEO title="Settings" description="Zilka-Kotab portal preferences" url="/portal/settings" />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-9">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {([['Name', user?.name || 'Not set'], ['Email', user?.email ?? ''], ['Role', user?.role ?? '']] as const).map(([k, v]) => (
            <div key={k} className="bg-card px-4 py-3"><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{k}</dt><dd className="mt-1 truncate text-sm font-medium" data-testid={`text-setting-${k.toLowerCase()}`}>{v}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">Account details come from firm Microsoft sign-in and are managed by an administrator.</p>

        {user?.role === 'ADMIN' && <AddPortalUser />}
        {user?.role === 'ADMIN' && <FeeScheduleImport />}

        <section aria-label="Active assignees" className="mt-6 rounded-xl border border-border bg-card p-4" data-testid="panel-assignees">
          <h2 className="font-semibold">Active assignees</h2>
          <p className="text-xs text-muted-foreground">Firm staff who can be assigned workflow rows.</p>
          {ops.isLoading ? <div className="mt-3 h-16 animate-pulse rounded bg-muted" /> : staff.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No active assignees yet.</p> : (
            <ul className="mt-3 divide-y divide-border text-sm">{staff.map((s) => <li key={s.id} data-testid={`text-assignee-${s.id}`} className="flex items-center justify-between py-1.5"><span className="font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{'role' in s ? String((s as { role?: string }).role ?? '') : ''}</span></li>)}</ul>
          )}
        </section>
      </div>
      <div className="mt-6"><InternalWorkflowOperations section="notifications" /></div>
    </div>
  );
}
