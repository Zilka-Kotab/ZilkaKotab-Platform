import { useParams, Link } from 'wouter';
import { usePortalTool } from '@/lib/hooks-portal';
import { Loader2, Wrench, Briefcase, ArrowLeft } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function PortalToolDetail() {
  const params = useParams();
  const slug = params.toolSlug || '';
  const { data, isLoading, error } = usePortalTool(slug);

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
          <p className="text-red-800">Failed to load tool details.</p>
        </div>
      </div>
    );
  }

  const { tool, projects } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SEO title={tool.name} description={tool.description} url={`/portal/tools/${tool.slug}`} />
      
      <div className="mb-6">
        <Link href="/portal/tools" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Tools
        </Link>
      </div>

      <div className="mb-10 flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 flex-shrink-0">
          <Wrench className="h-8 w-8 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold font-display text-foreground">{tool.name}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              tool.active ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
            }`}>
              {tool.active ? 'Operational' : 'Maintenance'}
            </span>
          </div>
          <p className="mt-2 text-lg text-muted-foreground max-w-2xl">{tool.description}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Projects in this Tool</h2>
          </div>
          <span className="text-sm font-medium text-muted-foreground">{projects.length} Total</span>
        </div>
        
        <div className="divide-y divide-border">
          {projects.map(project => (
            <div key={project.id} className="p-6 transition-colors hover:bg-muted/10">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-foreground text-lg">{project.name}</h3>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {project.status}
                </span>
              </div>
              <p className="text-muted-foreground mb-4">{project.description}</p>
              
              {/* Future: Launch Tool / View Project button would go here */}
              <button disabled className="inline-flex h-9 items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-muted-foreground cursor-not-allowed">
                Open Workspace (Coming Soon)
              </button>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-muted-foreground">No projects found for this tool.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
