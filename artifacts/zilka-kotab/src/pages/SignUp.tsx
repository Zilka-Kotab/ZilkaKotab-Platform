import { useState } from 'react';
import { SignUp, useSignUp } from '@clerk/react';
import { Link, Redirect } from 'wouter';
import { useAuth } from '@workspace/entra-auth-web';
import { SEO } from '@/components/SEO';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export default function SignUpPage() {
  const { isAuthenticated, isLoading } = useAuth();
  // Clerk verifies the invitation ticket. A bare registration route isn't advertised.
  const [hasTicket] = useState(() => !!new URLSearchParams(window.location.search).get('__clerk_ticket'));
  const { signUp } = useSignUp();
  if (isAuthenticated) return <Redirect to="/portal" />;
  if (isLoading) return <main className="flex-1 px-4 py-16 text-center">Loading invitation…</main>;
  return <>
    <SEO title="Activate Portal Access" description="Accept your invitation to the private Zilka-Kotab portal." url="/sign-up" />
    <main className="flex flex-1 justify-center bg-background px-4 py-16">
      {hasTicket || signUp?.status === 'missing_requirements'
        ? <SignUp routing="path" path={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/portal`} />
        : <div className="max-w-md rounded-xl border border-border bg-white p-8 text-center">
          <h1 className="mb-3 text-2xl font-display font-semibold">Invitation required</h1>
          <p className="text-muted-foreground">This portal is for firm-approved clients and staff. Use the link in your invitation, or request activation from the sign-in page.</p>
          <Link href="/sign-in" className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-white">Go to sign in</Link>
        </div>}
    </main>
  </>;
}
