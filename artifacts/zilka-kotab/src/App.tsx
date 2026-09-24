import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { HelmetProvider } from 'react-helmet-async';
import { useAuth } from '@workspace/entra-auth-web';

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
import PatentDetail from '@/pages/portal/PatentDetail';
import ClaimAnalysis from '@/pages/portal/ClaimAnalysis';

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

function ProtectedPortalRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/sign-in" />;
  
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
        <ProtectedPortalRoute component={PortalAdmin} />
      </Route>
      <Route path="/portal/projects/:projectId">
        <ProtectedPortalRoute component={ProjectWorkspace} />
      </Route>
      <Route path="/portal/patents/:patentId/claims/:claimId/analysis">
        <ProtectedPortalRoute component={ClaimAnalysis} />
      </Route>
      <Route path="/portal/patents/:patentId">
        <ProtectedPortalRoute component={PatentDetail} />
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
