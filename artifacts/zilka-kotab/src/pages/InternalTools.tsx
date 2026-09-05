import { UserButton, useUser } from '@clerk/react';
import { LockKeyhole, Wrench } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function InternalTools() {
  const { user } = useUser();

  return (
    <>
      <SEO
        title="Internal Tools"
        description="Private tools for approved Zilka-Kotab employees and guests."
        url="/internal"
      />
      <main className="flex-1 bg-background px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-12 flex items-start justify-between gap-6">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                <LockKeyhole className="h-4 w-4" />
                Private workspace
              </div>
              <h1 className="text-4xl font-bold font-display text-foreground md:text-6xl">
                Welcome{user?.firstName ? `, ${user.firstName}` : ''}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                Your approved internal tools will appear here as they become available.
              </p>
            </div>
            <UserButton />
          </div>

          <section className="rounded-2xl border border-border bg-white p-8 shadow-lg md:p-12">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/15">
              <Wrench className="h-7 w-7 text-accent" />
            </div>
            <h2 className="text-2xl font-semibold font-display text-foreground">
              Internal tools are coming soon
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Authentication is active and this page is protected. We can add employee resources,
              reporting tools, document workflows, or other private utilities here next.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}