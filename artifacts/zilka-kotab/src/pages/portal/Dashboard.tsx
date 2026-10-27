import { Link } from 'wouter';
import { SEO } from '@/components/SEO';
import { usePortalAccess, usePortalDashboard } from '@/lib/hooks-portal';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronRight,
  CircleAlert,
  FileKey2,
  LockKeyhole,
  RefreshCw,
  Users,
  Wrench,
} from 'lucide-react';

export default function PortalDashboard() {
  const { data: accessData } = usePortalAccess();
  const { data: dashboardData, isLoading, isError, refetch } = usePortalDashboard();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1240px] p-5 sm:p-8">
        <div className="animate-pulse space-y-5">
          <div className="h-3 w-28 rounded bg-muted" />
          <div className="h-12 max-w-xl rounded bg-muted" />
          <div className="h-5 max-w-2xl rounded bg-muted" />
          <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <div className="h-52 rounded-2xl bg-muted" />
            <div className="h-52 rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !dashboardData) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-3xl items-center justify-center p-5 sm:p-8">
        <div className="portal-card w-full rounded-2xl border bg-card p-8 text-center">
          <CircleAlert className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Dashboard unavailable</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">We could not retrieve your private workspace summary. Your access has not changed.</p>
          <button type="button" onClick={() => refetch()} data-testid="button-retry-dashboard" className="portal-action mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><RefreshCw className="h-4 w-4" /> Try again</button>
        </div>
      </div>
    );
  }

  const role = accessData?.user?.role;
  const isAttorneyOrAdmin = role === 'ATTORNEY' || role === 'ADMIN';
  const canUseInternalWorkflow = isAttorneyOrAdmin || role === 'PARALEGAL';
  const displayName = accessData?.user?.name?.split(' ')[0] || 'there';
  const projectCount = dashboardData.projects.length;
  const clientCount = dashboardData.clients?.length ?? 0;

  return (
    <div className="min-h-[100dvh]">
      <SEO title="Dashboard" description="Zilka-Kotab Portal Dashboard" url="/portal" />
      <div className="mx-auto max-w-[1240px] px-5 py-7 sm:px-8 sm:py-10 lg:px-10">
        <header className="relative overflow-hidden rounded-2xl border border-[#315778] bg-[#173c61] px-6 py-7 text-[#f4f7f9] shadow-[0_20px_48px_-30px_rgba(23,60,97,.8)] sm:px-9 sm:py-9">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[34px] border-[#c49a49]/15" />
          <div className="pointer-events-none absolute -bottom-32 right-20 h-60 w-60 rounded-full border border-[#c49a49]/20" />
          <div className="relative max-w-2xl">
            <p className="portal-eyebrow text-[10px] font-bold uppercase">Zilka-Kotab / private client portal</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Good to see you, {displayName}.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#c9d8e3]">A focused view of the matters, source records, and patent intelligence entrusted to your team.</p>
          </div>
          <div className="relative mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#456782] pt-4 text-[11px] text-[#c9d8e3]">
            <span className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5 text-[#e0b968]" /> Authorized {role?.toLowerCase() ?? 'portal'} access</span>
            <span className="hidden h-3 w-px bg-[#456782] sm:block" />
            <span>Confidential workspace</span>
          </div>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Workspace summary">
          <div className="portal-card border bg-card px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Active matters</p>
            <p className="mt-1 font-display text-3xl font-semibold text-foreground">{projectCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Projects available to you</p>
          </div>
          <div className="portal-card border bg-card px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Firm tools</p>
            <p className="mt-1 font-display text-3xl font-semibold text-foreground">{dashboardData.tools.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Secure tools in this workspace</p>
          </div>
          {isAttorneyOrAdmin ? (
            <div className="portal-card border bg-card px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Client relationships</p>
              <p className="mt-1 font-display text-3xl font-semibold text-foreground">{clientCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Assigned client accounts</p>
            </div>
          ) : (
            <div className="portal-card border bg-card px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Workspace status</p>
              <p className="mt-1 font-display text-3xl font-semibold text-emerald-700">Ready</p>
              <p className="mt-1 text-xs text-muted-foreground">Your access is active</p>
            </div>
          )}
        </section>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <section className="portal-card border bg-card">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="portal-eyebrow text-[10px] font-bold uppercase">Portfolio access</p>
                <h2 className="mt-1 font-display text-xl font-semibold">Recent projects</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Open a matter to review its trusted patent source data.</p>
              </div>
              <BriefcaseBusiness className="mt-1 h-5 w-5 text-primary/70" />
            </div>
            <div className="divide-y divide-border">
              {dashboardData.projects.length === 0 ? (
                <div className="px-6 py-12 text-center"><FileKey2 className="mx-auto h-6 w-6 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold">No projects assigned</p><p className="mt-1 text-xs text-muted-foreground">Your Zilka-Kotab contact will let you know when a matter is ready.</p></div>
              ) : dashboardData.projects.slice(0, 6).map((project) => (
                <Link key={project.publicId} href={`/portal/projects/${project.publicId}`} data-testid={`link-project-${project.publicId}`} className="portal-action portal-focus group flex items-center justify-between gap-4 px-6 py-4 hover:bg-primary/[0.035]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-foreground">{project.name}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{project.status}</span></div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{project.description || 'Patent portfolio workspace'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>

          <section className="portal-card border bg-card">
            <div className="border-b border-border px-6 py-5">
              <p className="portal-eyebrow text-[10px] font-bold uppercase">Your toolkit</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Available tools</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Approved services for your matters.</p>
            </div>
            <div className="space-y-2 p-4">
              {dashboardData.tools.length === 0 && !canUseInternalWorkflow ? (
                <div className="px-2 py-8 text-center"><Wrench className="mx-auto h-6 w-6 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold">No tools available</p></div>
              ) : (
                <>
                {canUseInternalWorkflow && (
                  <Link href="/portal/internal-workflow" data-testid="link-tool-internal-workflow-dashboard" className="portal-action portal-focus group flex items-center gap-3 rounded-xl border border-[#d5c79f] bg-[#fffdf8] p-3 hover:border-[#ad8b43] hover:bg-[#fbf7ec]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f4ecd5] text-[#795f25]"><BriefcaseBusiness className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Internal Workflow &amp; Docketing</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">AppColl matter imports and firm operations</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </Link>
                )}
                {dashboardData.tools.slice(0, canUseInternalWorkflow ? 3 : 4).map((tool) => (
                <Link key={tool.publicId} href={`/portal/tools/${tool.slug}`} data-testid={`link-tool-${tool.publicId}`} className="portal-action portal-focus group flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/30 hover:bg-primary/[0.035]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Wrench className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{tool.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{tool.description}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
                ))}
                </>
              )}
            </div>
            <Link href="/portal/tools" className="flex items-center gap-1 border-t border-border px-6 py-4 text-xs font-bold text-primary hover:underline">Browse tools <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </section>
        </div>

        {isAttorneyOrAdmin && dashboardData.clients && (
          <section className="portal-card mt-5 border bg-card">
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
              <div><p className="portal-eyebrow text-[10px] font-bold uppercase">Attorney view</p><h2 className="mt-1 font-display text-xl font-semibold">Assigned clients</h2></div>
              <Users className="h-5 w-5 text-primary/70" />
            </div>
            <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {dashboardData.clients.length === 0 ? <p className="px-2 py-5 text-sm text-muted-foreground">No client relationships assigned.</p> : dashboardData.clients.slice(0, 6).map((client) => (
                <Link key={client.publicId} href={`/portal/clients/${client.publicId}`} data-testid={`link-client-${client.publicId}`} className="portal-action portal-focus flex items-center justify-between rounded-xl border border-border p-3 hover:border-primary/30 hover:bg-primary/[0.035]"><span className="text-sm font-semibold">{client.name}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}