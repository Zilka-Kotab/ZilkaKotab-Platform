import { SEO } from '@/components/SEO';
import { StaffOnly } from '@/components/portal/StaffOnly';
import { usePortalAccess } from '@/lib/hooks-portal';
import InternalWorkflowOperations from './InternalWorkflowOperations';

export default function FirmSettings() {
  return <StaffOnly><SettingsPage /></StaffOnly>;
}

function SettingsPage() {
  const user = usePortalAccess().data?.user;
  return (
    <div className="py-6">
      <SEO title="Settings" description="Zilka-Kotab portal preferences" url="/portal/settings" />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-9">
        <p className="portal-eyebrow text-[10px] font-bold uppercase">Settings</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Preferences and notifications</h1>
        <dl className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {([['Name', user?.name || 'Not set'], ['Email', user?.email ?? ''], ['Role', user?.role ?? '']] as const).map(([k, v]) => (
            <div key={k} className="bg-card px-4 py-3"><dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{k}</dt><dd className="mt-1 truncate text-sm font-medium" data-testid={`text-setting-${k.toLowerCase()}`}>{v}</dd></div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">Account details come from firm sign-in and are managed by an administrator.</p>
      </div>
      <div className="mt-6"><InternalWorkflowOperations section="notifications" /></div>
    </div>
  );
}
