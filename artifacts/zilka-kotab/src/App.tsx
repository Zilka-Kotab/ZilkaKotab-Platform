import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { HelmetProvider } from 'react-helmet-async';
import { ClerkProvider, Show, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';

// Layout Components
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ScrollToTop } from '@/components/ScrollToTop';

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
import SignUpPage from '@/pages/SignUp';
import InternalTools from '@/pages/InternalTools';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'bottom' as const,
  },
  variables: {
    colorPrimary: '#293f73',
    colorForeground: '#20283d',
    colorMutedForeground: '#667085',
    colorDanger: '#b42318',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#20283d',
    colorNeutral: '#d8d5cc',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'flex w-full min-w-0 max-w-full justify-center',
    cardBox: 'w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-white shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!hidden',
    headerTitle: 'text-foreground font-semibold',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground font-medium',
    formFieldLabel: 'text-foreground font-medium',
    footerActionLink: 'text-primary font-semibold',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-muted-foreground',
    identityPreviewEditButton: 'text-primary',
    formFieldSuccessText: 'text-green-700',
    alertText: 'text-red-700',
    logoBox: 'h-14',
    logoImage: 'h-12 w-auto',
    socialButtonsBlock: 'hidden',
    socialButtonsBlockButton: 'hidden',
    formButtonPrimary: 'bg-primary hover:bg-primary/90 text-white',
    formFieldInput: 'border-border bg-white text-foreground',
    footerAction: 'hidden',
    dividerRow: 'hidden',
    dividerLine: 'hidden',
    alert: 'border-red-200 bg-red-50',
    otpCodeFieldInput: 'border-border',
    formFieldRow: 'text-foreground',
    main: 'gap-5',
  },
};

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return <Redirect to="/internal" />;
  }

  return <Home />;
}

function ProtectedInternalTools() {
  return (
    <>
      <Show when="signed-in">
        <InternalTools />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const activeQueryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        activeQueryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, activeQueryClient]);

  return null;
}

function Router() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <ScrollToTop />
      <Navbar />
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/internal" component={ProtectedInternalTools} />
        <Route path="/about" component={About} />
        <Route path="/services" component={Services} />
        <Route path="/team" component={Team} />
        <Route path="/team/:slug" component={TeamMember} />
        <Route path="/contact" component={Contact} />
        <Route path="/privacy-policy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route component={NotFound} />
      </Switch>
      <Footer />
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Private Access',
            subtitle: 'Sign in with your approved Zilka-Kotab account',
          },
        },
        signUp: {
          start: {
            title: 'Activate your account',
            subtitle: 'Use your administrator-approved email address',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <HelmetProvider>
            <Router />
          </HelmetProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
