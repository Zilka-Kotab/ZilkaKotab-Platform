import { SignUp } from '@clerk/react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function SignUpPage() {
  return (
    <>
      <SEO
        title="Activate Internal Account"
        description="Create a secure account for approved Zilka-Kotab internal access."
        url="/sign-up"
      />
      <main className="relative flex-1 overflow-hidden bg-background px-4 py-16 md:py-24">
        <div className="relative mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1fr_440px]">
          <section className="max-w-xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Account activation
            </p>
            <h1 className="mb-6 text-4xl font-bold font-display text-foreground md:text-6xl">
              Establish your secure account
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Use the email address approved by the firm administrator. You will create and
              verify your own password privately.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              Already activated?{' '}
              <Link href="/sign-in" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </section>
          <div className="w-full min-w-0 max-w-full">
            <SignUp
              routing="path"
              path={`${basePath}/sign-up`}
              signInUrl={`${basePath}/sign-in`}
              forceRedirectUrl={`${basePath}/internal`}
            />
          </div>
        </div>
      </main>
    </>
  );
}