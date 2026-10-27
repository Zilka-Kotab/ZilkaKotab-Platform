import { usePortalAccess, usePortalTools } from '@/lib/hooks-portal';
import { BriefcaseBusiness, Loader2, Wrench, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';

export default function PortalTools() {
  const { data, isLoading, error } = usePortalTools();
  const { data: accessData } = usePortalAccess();
  const isAdmin = accessData?.user?.role === 'ADMIN';

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
          <p className="text-red-800">Failed to load tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SEO title="Tools" description="Zilka-Kotab Tools" url="/portal/tools" />
      
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Wrench className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Tools Hub</h1>
          <p className="mt-1 text-muted-foreground">Select a tool to access related projects and capabilities.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isAdmin && (
          <Link
            href="/portal/internal-workflow"
            data-testid="link-tool-internal-workflow"
            className="group flex h-full flex-col rounded-xl border border-[#d5c79f] bg-[#fffdf8] p-6 shadow-sm transition-all hover:border-[#ad8b43] hover:shadow-md"
          >
            <div className="mb-4 flex items-start justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f4ecd5] text-[#795f25]">
                <BriefcaseBusiness className="h-5 w-5" />
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Internal Workflow &amp; Docketing</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">
              Import AppColl matter records, review changes, and manage the firm’s internal operations workspace.
            </p>
            <span className="mt-5 inline-flex w-fit items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white">
              Open Tool
            </span>
            <div className="mt-6 flex items-center justify-between border-t border-[#e8dfc9] pt-4 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Operational
              </span>
              <span className="font-semibold uppercase tracking-wide text-[#795f25]">Internal</span>
            </div>
          </Link>
        )}
        {data.tools.map(tool => (
            <Link key={tool.publicId} href={`/portal/tools/${tool.slug}`} className="group rounded-xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary flex flex-col h-full">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">{tool.name}</h3>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-sm text-muted-foreground flex-1">{tool.description}</p>
              <span className="mt-5 inline-flex w-fit items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white">Open Tool</span>
            <div className="mt-6 pt-4 border-t border-border flex justify-between items-center text-xs">
              <span className={`inline-flex items-center gap-1.5 font-medium ${tool.active ? 'text-green-600' : 'text-muted-foreground'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tool.active ? 'bg-green-600' : 'bg-muted-foreground'}`} />
                {tool.active ? 'Operational' : 'Maintenance'}
              </span>
            </div>
          </Link>
        ))}
        {data.tools.length === 0 && !isAdmin && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center">
            <Wrench className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No tools available</h3>
            <p className="text-muted-foreground">There are no tools provisioned for your account.</p>
          </div>
        )}
      </div>
    </div>
  );
}
