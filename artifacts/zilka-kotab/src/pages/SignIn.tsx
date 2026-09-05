import { SignIn } from '@clerk/react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function SignInPage() {
  return (
    <>
      <SEO
        title="Employee Login"
        description="Secure login for approved Zilka-Kotab employees and guests."
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
            <h1 className="mb-6 text-4xl font-bold font-display text-foreground md:text-6xl">
              Zilka-Kotab AI Tools
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Zilka-Kotab creates its own AI-driven tools to analyze, manage, and act on
              intellectual property with unprecedented speed and precision.{' '}
              <Link href="/contact" className="font-semibold text-primary hover:underline">
                Contact us
              </Link>{' '}
              to find out more.
            </p>
            <div className="mt-8 rounded-xl border border-border bg-white/70 p-5 text-sm leading-relaxed text-muted-foreground">
              Need access? Contact the firm administrator. Accounts are created by invitation only.
            </div>
          </section>
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            forceRedirectUrl={`${basePath}/internal`}
            withSignUp={false}
          />
        </div>
      </main>
    </>
  );
}