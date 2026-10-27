import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@workspace/entra-auth-web';
import { usePortalAccess } from '@/lib/hooks-portal';
import { LayoutDashboard, Users, Wrench, Settings, LogOut, Loader2, ShieldAlert } from 'lucide-react';
import { SEO } from '@/components/SEO';

interface PortalLayoutProps {
  children: ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  const [location] = useLocation();
  const { user: authUser, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();
  const { data: accessData, isLoading: isAccessLoading, error: accessError } = usePortalAccess();

  const isPortalLoading = isAuthLoading || (isAuthenticated && isAccessLoading);
  
  if (isPortalLoading) {
    return (
      <div className="portal-shell flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Securing your workspace
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="portal-shell flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <div className="portal-card w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldAlert className="h-6 w-6" /></div>
          <p className="portal-eyebrow text-[10px] font-bold uppercase">Private client workspace</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-foreground">Authentication required</h1>
          <p className="mb-6 mt-2 text-sm leading-6 text-muted-foreground">Please sign in to access Zilka-Kotab’s secure portal.</p>
          <Link href="/sign-in" className="portal-action inline-flex h-10 items-center justify-center rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  const portalUser = accessData?.user;

  if (accessError || !portalUser || !portalUser.active) {
    return (
      <div className="portal-shell flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-red-100 text-red-700"><ShieldAlert className="h-6 w-6" /></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">Zilka-Kotab private portal</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-red-950">Access not authorized</h1>
          <p className="mb-6 mt-2 text-sm leading-6 text-red-800">
            Your account has not been authorized to access the Zilka-Kotab client portal. Please contact Zilka-Kotab for assistance.
          </p>
          <button 
            onClick={() => logout()} 
            className="portal-action inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-card px-8 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const role = portalUser.role;
  const isClient = role === 'CLIENT';
  const isAttorney = role === 'ATTORNEY';
  const isAdmin = role === 'ADMIN';

  const navItems = [
    { label: 'Dashboard', href: '/portal', icon: <LayoutDashboard className="h-5 w-5" />, visible: true },
    { label: 'My Clients', href: '/portal/clients', icon: <Users className="h-5 w-5" />, visible: isAttorney },
    { label: 'Tools', href: '/portal/tools', icon: <Wrench className="h-5 w-5" />, visible: isClient || isAttorney || isAdmin },
    { label: 'Admin', href: '/portal/admin', icon: <Settings className="h-5 w-5" />, visible: isAdmin },
  ].filter(item => item.visible);

  return (
    <div className="portal-shell min-h-[100dvh]">
      <SEO title="Secure Portal" description="Zilka-Kotab Secure Portal" url="/portal" />
      <div className="flex min-h-[100dvh] bg-transparent">
        <aside className="portal-sidebar relative hidden w-[252px] shrink-0 flex-col border-r border-[#315778] md:flex">
          <div className="relative z-10 flex h-[76px] items-center border-b border-[#315778] px-7">
            <Link href="/" className="portal-focus flex items-center gap-3 rounded-sm">
              <span className="grid h-8 w-8 place-items-center border border-[#c49a49]/70 text-[11px] font-bold tracking-tight text-[#e2b86a]">ZK</span>
              <span className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#f2f5f7]">Zilka-Kotab<span className="text-[#c49a49]">.</span></span>
            </Link>
          </div>
          
          <div className="relative z-10 flex flex-1 flex-col p-5">
            <div className="mb-8 border-b border-[#315778] px-2 pb-6">
              <p className="portal-eyebrow text-[10px] font-bold uppercase">
                {role} workspace
              </p>
              <p className="mt-2 truncate text-sm font-medium text-[#f2f5f7]" title={portalUser.name || [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ') || portalUser.email}>
                {portalUser.name || [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ') || portalUser.email}
              </p>
              <p className="mt-1 truncate text-[11px] text-[#a9bfd0]">{portalUser.email}</p>
            </div>

            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== '/portal' && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-testid={`link-portal-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`portal-focus flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      isActive 
                         ? 'border-[#c49a49]/35 bg-[#c49a49]/10 text-[#f7d58d]'
                         : 'border-transparent text-[#b9cad7] hover:border-[#315778] hover:bg-[#214a6a] hover:text-[#f2f5f7]'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="relative z-10 border-t border-[#315778] p-5">
            <button
              onClick={() => logout()}
              data-testid="button-portal-sign-out"
              className="portal-focus flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-[#b9cad7] transition hover:border-[#315778] hover:bg-[#214a6a] hover:text-[#f7d58d]"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="portal-main min-w-0 flex-1 overflow-auto">
          <div className="border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center border border-primary/40 text-[10px] font-bold text-primary">ZK</span><span className="font-display text-sm font-semibold">Zilka-Kotab<span className="text-accent">.</span></span></Link>
              <button type="button" onClick={() => logout()} data-testid="button-mobile-sign-out" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><LogOut className="h-4 w-4" /></button>
            </div>
            <nav className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== '/portal' && location.startsWith(item.href));
                return <Link key={item.href} href={item.href} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{item.icon}{item.label}</Link>;
              })}
            </nav>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
