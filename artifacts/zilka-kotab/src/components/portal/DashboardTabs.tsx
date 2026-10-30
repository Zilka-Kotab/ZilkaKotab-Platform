import { Link, useLocation } from 'wouter';
import { ClipboardList, Receipt, SlidersHorizontal } from 'lucide-react';

export const DASHBOARD_ROUTES = ['/portal/internal-workflow', '/portal/billing', '/portal/settings'];
export const isDashboardRoute = (loc: string) => loc === '/portal' || DASHBOARD_ROUTES.some((r) => loc.startsWith(r));

const tabs = [
  { href: '/portal/internal-workflow', label: 'Workflow', icon: ClipboardList },
  { href: '/portal/billing', label: 'Time & Billing', icon: Receipt },
  { href: '/portal/settings', label: 'Settings', icon: SlidersHorizontal },
];

/** Shared header for the staff Dashboard: Workflow / Time & Billing / Settings live as tabs here. */
export function DashboardTabs() {
  const [location] = useLocation();
  return (
    <div className="border-b border-border bg-card/70">
      <div className="mx-auto max-w-[1600px] px-4 pt-5 sm:px-6 lg:px-9">
        <p className="portal-eyebrow text-[10px] font-bold uppercase">Zilka-Kotab</p>
        <p className="mt-0.5 font-display text-lg font-semibold" data-testid="text-dashboard-title">Dashboard</p>
        <nav aria-label="Dashboard sections" className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = location.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} data-testid={`tab-dashboard-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition ${active ? 'border-[#c49a49] text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
