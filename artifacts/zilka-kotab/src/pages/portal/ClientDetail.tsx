import { useParams, Link } from 'wouter';
import { usePortalClient } from '@/lib/hooks-portal';
import { Loader2, Building2, Wrench, Briefcase, ChevronRight, ArrowLeft } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function PortalClientDetail() {
  const params = useParams();
  const clientId = params.clientId || '';
  const { data, isLoading, error } = usePortalClient(clientId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-red-800">Failed to load client details. You may not have permission.</p>
        </div>
      </div>
    );
  }

  const { client, tools, projects } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SEO title={client.name} description={`Client portal for ${client.name}`} url={`/portal/clients/${client.publicId}`} />
      
      <div className="mb-6">
        <Link href="/portal/clients" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to My Clients
        </Link>
      </div>

      <div className="mb-10 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">{client.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`inline-block h-2 w-2 rounded-full ${client.active ? 'bg-green-500' : 'bg-red-500'}`} />
            {client.active ? 'Active Account' : 'Inactive Account'}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Client Tools */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold font-display text-foreground">Available Tools</h2>
          </div>
          <div className="grid gap-4">
            {tools.map(tool => (
              <Link key={tool.publicId} href={`/portal/tools/${tool.slug}`} className="group rounded-xl border border-border bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-primary">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{tool.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
            {tools.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">No tools provisioned for this client.</p>
              </div>
            )}
          </div>
        </section>

        {/* Client Projects */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold font-display text-foreground">Projects</h2>
          </div>
          <div className="grid gap-4">
            {projects.map(project => {
              const tool = tools.find(t => t.publicId === project.toolId);
              return (
                <Link href={`/portal/projects/${project.publicId}`} key={project.publicId} className="block rounded-xl border border-border bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-foreground">{project.name}</h3>
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {project.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                    <span>Tool: <span className="font-medium text-foreground">{tool?.name || 'Unknown'}</span></span>
                  </div>
                </Link>
              );
            })}
            {projects.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">No projects created yet.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}