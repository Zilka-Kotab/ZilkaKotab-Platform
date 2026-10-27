import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { HelmetProvider } from 'react-helmet-async';
import { useAuth } from '@workspace/entra-auth-web';
import { Loader2, ShieldAlert } from 'lucide-react';
import { usePortalAccess } from '@/lib/hooks-portal';
import type { Role } from '@/lib/api-portal';

// Layout Components
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ScrollToTop } from '@/components/ScrollToTop';
import { PortalLayout } from '@/components/portal/PortalLayout';

// Pages
import Home from '@/pages/Home';
import About from '@/pages/About';
import Services from '@/pages/Services';
import Team from '@/pages/Team';
import TeamMember from '@/pages/TeamMember';
import Contact from '@/pages/Contact';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import SignInPage from '@/pages/SignIn';
import NotFound from '@/pages/not-found';

import PortalDashboard from '@/pages/portal/Dashboard';
import PortalClients from '@/pages/portal/Clients';
import PortalClientDetail from '@/pages/portal/ClientDetail';
import PortalTools from '@/pages/portal/Tools';
import PortalToolDetail from '@/pages/portal/ToolDetail';
import PortalAdmin from '@/pages/portal/Admin';
import ProjectWorkspace from '@/pages/portal/ProjectWorkspace';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function HomeRoute() {
  return <Home />;
}

function ProtectedPortalRoute({ component: Component, requiredRole }: { component: React.ComponentType; requiredRole?: Role }) {
  const { isLoading, isAuthenticated } = useAuth();
  const { data: accessData, isLoading: isAccessLoading, error: accessError } = usePortalAccess(isAuthenticated);

  if (isLoading || (isAuthenticated && isAccessLoading)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/sign-in" />;

  const portalUser = accessData?.user;
  if (accessError || !portalUser || !portalUser.active || (requiredRole && portalUser.role !== requiredRole)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-xl">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h1 className="mb-2 text-2xl font-bold text-red-900">Access Not Authorized</h1>
          <p className="text-red-800">Your account is not approved for this private area.</p>
        </div>
      </div>
    );
  }

  return (
    <PortalLayout>
      <Component />
    </PortalLayout>
  );
}

function AuthQueryClientCacheInvalidator() {
  const { user } = useAuth();
  const activeQueryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      activeQueryClient.clear();
    }
    previousUserId.current = userId;
  }, [user, activeQueryClient]);

  return null;
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <ScrollToTop />
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Portal Routes */}
      <Route path="/portal">
        <ProtectedPortalRoute component={PortalDashboard} />
      </Route>
      <Route path="/portal/clients">
        <ProtectedPortalRoute component={PortalClients} />
      </Route>
      <Route path="/portal/clients/:clientId">
        <ProtectedPortalRoute component={PortalClientDetail} />
      </Route>
      <Route path="/portal/tools">
        <ProtectedPortalRoute component={PortalTools} />
      </Route>
      <Route path="/portal/tools/:toolSlug">
        <ProtectedPortalRoute component={PortalToolDetail} />
      </Route>
      <Route path="/portal/admin">
        <ProtectedPortalRoute component={PortalAdmin} requiredRole="ADMIN" />
      </Route>
      <Route path="/portal/projects/:projectId">
        <ProtectedPortalRoute component={ProjectWorkspace} />
      </Route>
      {/* Public Routes */}
      <Route>
        <PublicLayout>
          <Switch>
            <Route path="/" component={HomeRoute} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/about" component={About} />
            <Route path="/services" component={Services} />
            <Route path="/team" component={Team} />
            <Route path="/team/:slug" component={TeamMember} />
            <Route path="/contact" component={Contact} />
            <Route path="/privacy-policy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route component={NotFound} />
          </Switch>
        </PublicLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthQueryClientCacheInvalidator />
        <TooltipProvider>
          <HelmetProvider>
            <Router />
          </HelmetProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
