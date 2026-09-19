import { usePortalClients } from '@/lib/hooks-portal';
import { Loader2, Users, Building2, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';

export default function PortalClients() {
  const { data, isLoading, error } = usePortalClients();

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
          <p className="text-red-800">Failed to load clients. You may not have permission.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SEO title="My Clients" description="Zilka-Kotab Assigned Clients" url="/portal/clients" />
      
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">My Clients</h1>
          <p className="mt-1 text-muted-foreground">Select a client to view their tools and projects.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.clients.map(client => (
          <Link key={client.id} href={`/portal/clients/${client.id}`} className="group rounded-xl border border-border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-primary">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                  <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{client.name}</h3>
                  <p className="text-xs text-muted-foreground">{client.active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
        {data.clients.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No clients assigned</h3>
            <p className="text-muted-foreground">You don't have any active client assignments yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
