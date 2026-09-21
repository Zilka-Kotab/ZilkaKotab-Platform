import { usePortalAccess, usePortalDashboard } from '@/lib/hooks-portal';
import { Loader2, Wrench, Briefcase, Users, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';

export default function PortalDashboard() {
  const { data: accessData } = usePortalAccess();
  const { data: dashboardData, isLoading } = usePortalDashboard();

  if (isLoading || !dashboardData) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const role = accessData?.user?.role;
  const isAttorneyOrAdmin = role === 'ATTORNEY' || role === 'ADMIN';

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SEO title="Dashboard" description="Zilka-Kotab Portal Dashboard" url="/portal" />
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Welcome to your secure portal.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Tools Section */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Available Tools</h2>
          </div>
          <div className="flex-1 space-y-3">
            {dashboardData.tools.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tools available.</p>
            ) : (
              dashboardData.tools.map(tool => (
                <Link key={tool.publicId} href={`/portal/tools/${tool.slug}`} className="group flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-primary hover:bg-primary/5">
                  <div>
                    <p className="font-medium text-foreground text-sm">{tool.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{tool.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </Link>
              ))
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <Link href="/portal/tools" className="text-sm font-medium text-primary hover:underline">View all tools</Link>
          </div>
        </div>

        {/* Projects Section */}
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Briefcase className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Recent Projects</h2>
          </div>
          <div className="flex-1 space-y-3">
            {dashboardData.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            ) : (
              dashboardData.projects.slice(0, 5).map(project => (
                <div key={project.publicId} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground text-sm">{project.name}</p>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {project.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{project.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Clients Section (Attorney/Admin only) */}
        {isAttorneyOrAdmin && dashboardData.clients && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-700" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Assigned Clients</h2>
            </div>
            <div className="flex-1 space-y-3">
              {dashboardData.clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients assigned.</p>
              ) : (
                dashboardData.clients.slice(0, 5).map(client => (
                  <Link key={client.publicId} href={`/portal/clients/${client.publicId}`} className="group flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-green-600 hover:bg-green-50">
                    <p className="font-medium text-foreground text-sm">{client.name}</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-green-700" />
                  </Link>
                ))
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/portal/clients" className="text-sm font-medium text-primary hover:underline">View all clients</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
