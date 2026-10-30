import { useState, type FormEvent } from 'react';
import { SignIn } from '@clerk/react';
import { Redirect } from 'wouter';
import { useAuth } from '@workspace/entra-auth-web';
import { SEO } from '@/components/SEO';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function SignInPage() {
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function activate(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${basePath}/api/auth/activate`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to request activation. Please try again.');
      setMessage(result.message);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to request activation.'); }
    finally { setBusy(false); }
  }
  if (isAuthenticated) return <Redirect to="/portal" />;
  return <>
    <SEO title="Portal Login" description="Secure sign-in for approved Zilka-Kotab clients and staff. No Microsoft account required." url="/sign-in" />
    <main className="relative flex-1 bg-background px-4 py-16 md:py-24">
      <div className="mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-[1fr_440px]">
        <section className="max-w-xl lg:pt-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-accent">Authorized Access</p>
          <h1 className="mb-6 text-4xl font-bold font-display text-foreground md:text-6xl">Zilka-Kotab AI Hub</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">A secure, confidential workspace where clients and counsel collaborate on assigned matters using trusted AI tools.</p>
          <p className="mt-4 text-sm text-muted-foreground">Sign in with your approved email address. A Microsoft account is not required. Portal access is granted by the firm, not by creating an account.</p>
        </section>
        <section className="min-w-0" aria-label="Portal sign-in">
          <SignIn routing="path" path={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/portal`} withSignUp={false} appearance={{ elements: { footerAction: { display: 'none' } } }} />
          <details className="mx-auto mt-6 w-[440px] max-w-full rounded-xl border border-border bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-primary">First time here? Activate approved access</summary>
            <p className="mt-3 text-sm text-muted-foreground">Enter the email address approved by the firm. Invitations are sent only to approved users. Check your inbox and spam folder; contact the firm if no invitation arrives.</p>
            <form onSubmit={activate} className="mt-4 space-y-3">
              <label htmlFor="activation-email" className="block text-sm font-medium">Approved email address</label>
              <input id="activation-email" type="email" required maxLength={320} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-border px-3 py-2" />
              <button type="submit" disabled={busy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Requesting…' : 'Request activation invitation'}</button>
            </form>
            {message && <p role="status" className="mt-3 text-sm text-foreground">{message}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          </details>
        </section>
      </div>
    </main>
  </>;
}
