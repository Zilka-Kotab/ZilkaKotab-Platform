import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@workspace/replit-auth-web';
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-xl text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold text-foreground">Authentication Required</h1>
          <p className="mb-6 text-muted-foreground">Please sign in to access the portal.</p>
          <Link href="/sign-in" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-white transition-colors hover:bg-primary/90">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  const portalUser = accessData?.user;

  if (accessError || !portalUser || !portalUser.active) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 shadow-xl text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h1 className="mb-2 text-2xl font-bold text-red-900">Access Not Authorized</h1>
          <p className="mb-6 text-red-800">
            Your account has not been authorized to access the Zilka-Kotab client portal. Please contact Zilka-Kotab for assistance.
          </p>
          <button 
            onClick={() => logout()} 
            className="inline-flex h-10 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-red-700 border border-red-200 transition-colors hover:bg-red-50"
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
    { label: 'Tools', href: '/portal/tools', icon: <Wrench className="h-5 w-5" />, visible: isClient },
    { label: 'Admin', href: '/portal/admin', icon: <Settings className="h-5 w-5" />, visible: isAdmin },
  ].filter(item => item.visible);

  return (
    <>
      <SEO title="Secure Portal" description="Zilka-Kotab Secure Portal" url="/portal" />
      <div className="flex min-h-[100dvh] bg-background">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar">
          <div className="flex h-16 items-center border-b border-sidebar-border px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display text-lg font-bold text-sidebar-foreground">Zilka-Kotab</span>
            </Link>
          </div>
          
          <div className="p-4">
            <div className="mb-6 px-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {role} PORTAL
              </p>
              <p className="mt-1 font-medium text-sidebar-foreground truncate" title={portalUser.name || [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ') || portalUser.email}>
                {portalUser.name || [authUser?.firstName, authUser?.lastName].filter(Boolean).join(' ') || portalUser.email}
              </p>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== '/portal' && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="absolute bottom-0 w-64 border-t border-sidebar-border p-4">
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </>
  );
}
