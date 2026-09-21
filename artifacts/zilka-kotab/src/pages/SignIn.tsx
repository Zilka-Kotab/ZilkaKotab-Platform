import { useAuth } from '@workspace/entra-auth-web';
import { SEO } from '@/components/SEO';

export default function SignInPage() {
  const { login } = useAuth();
  
  return (
    <>
      <SEO
        title="Portal Login"
        description="Secure login for approved Zilka-Kotab clients and attorneys."
        url="/sign-in"
      />
      <main className="relative flex-1 overflow-hidden bg-background px-4 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="relative mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1fr_440px]">
          <section className="max-w-xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Authorized Access
            </p>
            <h1 className="mb-6 whitespace-nowrap text-4xl font-bold font-display text-foreground md:text-6xl">
              Zilka-Kotab AI Hub
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              A secure, confidential workspace where clients and counsel collaborate on assigned matters using trusted AI tools.
            </p>
          </section>
          <div className="w-full min-w-0 max-w-full">
            <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-white p-8 shadow-xl">
              <h2 className="text-2xl font-bold text-foreground mb-2">Sign In</h2>
              <p className="text-muted-foreground mb-8">Access your approved Zilka-Kotab portal.</p>
              
              <button
                onClick={() => login()}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                Sign in with Microsoft
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}