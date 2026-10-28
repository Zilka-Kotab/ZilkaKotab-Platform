import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAdminUsers, useAdminAudit, useAdminProjects, useAdminToolAccess, useAdminClientTools, usePortalClients, usePortalTools, useCreateAdminUser, useUpdateAdminUser, useCreateAdminClient, useUpdateAdminClient, useUpdateTool, useCreateTool, useSetClientTools, useCreateProject, useUpdateProject } from '@/lib/hooks-portal';
import { Loader2, Settings, Users, Building2, Wrench, Briefcase, Activity, Plus, Database, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetFirmBenchmarkStatus, getGetFirmBenchmarkStatusQueryKey, type FirmBenchmarkStatus } from '@workspace/api-client-react';
import { fetchPortal } from '@/lib/api-portal';
import { SEO } from '@/components/SEO';
import { PortalUser, Role, UserStatus, Client, Tool, Project } from '@/lib/api-portal';

export default function PortalAdmin() {
  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  const initialTab = requestedTab === 'clients' || requestedTab === 'tools' || requestedTab === 'projects' || requestedTab === 'audit' ? requestedTab : 'users';
  const [activeTab, setActiveTab] = useState<'users' | 'clients' | 'tools' | 'projects' | 'audit'>(initialTab);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SEO title="Admin Console" description="Zilka-Kotab Admin Console" url="/portal/admin" />
      
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <Settings className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Admin Console</h1>
          <p className="mt-1 text-muted-foreground">Manage users, clients, tools, projects, and access.</p>
        </div>
      </div>

      <FirmDataPanel />

      <div className="mb-6 flex space-x-1 rounded-xl bg-muted/50 p-1 w-max border border-border">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'users' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
          }`}
        >
          <Users className="h-4 w-4" /> Users
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'clients' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
          }`}
        >
          <Building2 className="h-4 w-4" /> Clients
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'tools' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
          }`}
        >
          <Wrench className="h-4 w-4" /> Tools
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'projects' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
          }`}
        >
          <Briefcase className="h-4 w-4" /> Projects
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'audit' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
          }`}
        >
          <Activity className="h-4 w-4" /> Audit Log
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        {activeTab === 'users' && <UsersAdmin />}
        {activeTab === 'clients' && <ClientsAdmin />}
        {activeTab === 'tools' && <ToolsAdmin />}
        {activeTab === 'projects' && <ProjectsAdmin />}
        {activeTab === 'audit' && <AuditAdmin />}
      </div>
    </div>
  );
}

function UsersAdmin() {
  const { data, isLoading } = useAdminUsers();
  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const { data: clientsData } = usePortalClients();
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('CLIENT');
  
  if (isLoading || !data) {
    return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ email, name, role, status: 'PENDING', active: false, clientAssignments: [] }, {
      onSuccess: () => {
        setEmail('');
        setName('');
        setRole('CLIENT');
      }
    });
  };

  return (
    <div>
      <div className="border-b border-border bg-muted/20 px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">Add User</h2>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-4 items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
            <input 
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm" placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
            <input 
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm" placeholder="John Doe"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
            <select 
              value={role} onChange={e => setRole(e.target.value as Role)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="CLIENT">Client</option>
              <option value="ATTORNEY">Attorney</option>
              <option value="PARALEGAL">Paralegal</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button 
            type="submit" disabled={createMutation.isPending}
            className="flex h-[38px] w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add User
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Role</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Client access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.users.map(user => (
              <tr key={user.publicId} className="hover:bg-muted/10">
                <td className="px-6 py-4 font-medium text-foreground">{user.name || '—'}</td>
                <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                <td className="px-6 py-4">
                  <select 
                    value={user.role} 
                    onChange={e => updateMutation.mutate({ id: user.publicId, data: { role: e.target.value as Role } })}
                    disabled={updateMutation.isPending}
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <option value="CLIENT">Client</option>
                    <option value="ATTORNEY">Attorney</option>
                    <option value="PARALEGAL">Paralegal</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.status}
                    onChange={event => updateMutation.mutate({ id: user.publicId, data: { status: event.target.value as UserStatus } })}
                    disabled={updateMutation.isPending}
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DEACTIVATED">Deactivated</option>
                  </select>
                </td>
                <td className="px-6 py-4 min-w-56">
                  {user.role === 'ADMIN' ? (
                    <span className="text-xs text-muted-foreground">All clients</span>
                  ) : user.role === 'PARALEGAL' ? (
                    <span className="text-xs text-muted-foreground">Matters listed to this paralegal in AppColl</span>
                  ) : (
                    <select
                      multiple
                      value={user.clientAssignments.map(String)}
                      onChange={(event) => updateMutation.mutate({
                         id: user.publicId,
                         data: { clientAssignments: Array.from(event.currentTarget.selectedOptions, option => option.value) },
                      })}
                      className="h-20 w-full rounded-md border border-border px-2 py-1 text-xs"
                      aria-label={`Client assignments for ${user.name}`}
                    >
                      {clientsData?.clients.map(client => <option key={client.publicId} value={client.publicId}>{client.name}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {data.users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClientsAdmin() {
  const { data, isLoading } = usePortalClients();
  const createMutation = useCreateAdminClient();
  const updateMutation = useUpdateAdminClient();
  const tools = usePortalTools();
  const setTools = useSetClientTools();
  const assignedTools = useAdminClientTools();
  const [toolSelections, setToolSelections] = useState<Record<string, string[]>>({});
  
  const [name, setName] = useState('');
  
  if (isLoading || !data) {
    return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, active: true }, {
      onSuccess: () => setName('')
    });
  };

  return (
    <div>
      <div className="border-b border-border bg-muted/20 px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">Create Client Organization</h2>
        <form onSubmit={handleCreate} className="flex gap-4 items-end max-w-xl">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Client Name</label>
            <input 
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm" placeholder="Acme Corp"
            />
          </div>
          <button 
            type="submit" disabled={createMutation.isPending}
            className="flex h-[38px] items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.clients.map(client => (
              <tr key={client.publicId} className="hover:bg-muted/10">
                <td className="px-6 py-4 font-medium text-foreground">{client.name}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => updateMutation.mutate({ id: client.publicId, data: { active: !client.active } })}
                    disabled={updateMutation.isPending}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                      client.active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {client.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <select
                      multiple
                      value={toolSelections[client.publicId] ?? assignedTools.data?.assignments.filter(item => item.clientId === client.publicId).map(item => item.toolId) ?? []}
                      onChange={(event) => setToolSelections(current => ({
                        ...current,
                        [client.publicId]: Array.from(event.currentTarget.selectedOptions, option => option.value),
                      }))}
                      className="h-20 min-w-44 rounded-md border border-border px-2 py-1 text-xs"
                      aria-label={`Tools for ${client.name}`}
                    >
                      {tools.data?.tools.map(tool => <option key={tool.publicId} value={tool.publicId}>{tool.name}</option>)}
                    </select>
                    <button
                      onClick={() => setTools.mutate({
                        clientId: client.publicId,
                        toolIds: toolSelections[client.publicId] ?? assignedTools.data?.assignments.filter(item => item.clientId === client.publicId).map(item => item.toolId) ?? [],
                      })}
                      className="text-primary hover:underline font-medium"
                    >Save tools</button>
                  </div>
                </td>
              </tr>
            ))}
            {data.clients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No clients found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToolsAdmin() {
  const { data, isLoading } = usePortalTools();
  const updateMutation = useUpdateTool();
  const createMutation = useCreateTool();
  const access = useAdminToolAccess();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  
  if (isLoading || !data) {
    return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="border-b border-border bg-muted/20 px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground">Manage Tools</h2>
        <form className="mt-4 flex max-w-2xl gap-3" onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate({ name, slug, description: '', active: true }, { onSuccess: () => { setName(''); setSlug(''); } });
        }}>
          <input required value={name} onChange={event => setName(event.target.value)} placeholder="Tool name" className="flex-1 rounded-md border border-border px-3 py-2 text-sm" />
          <input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={event => setSlug(event.target.value)} placeholder="tool-slug" className="flex-1 rounded-md border border-border px-3 py-2 text-sm" />
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white">Add tool</button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Slug</th>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium">Assigned clients</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.tools.map(tool => (
              <tr key={tool.publicId} className="hover:bg-muted/10">
                <td className="px-6 py-4 font-medium text-foreground">{tool.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{tool.slug}</td>
                <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{tool.description}</td>
                <td className="px-6 py-4 text-muted-foreground">
                  {access.data?.access.filter(item => item.toolId === tool.publicId).map(item => item.clientName).join(', ') || 'None'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => updateMutation.mutate({ id: tool.publicId, data: { active: !tool.active } })}
                    disabled={updateMutation.isPending}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                      tool.active ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    {tool.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  {tool.active
                    ? <Link href={`/portal/tools/${tool.slug}`} className="font-medium text-primary hover:underline">Open / manage</Link>
                    : <span className="text-xs text-muted-foreground">Activate to open</span>}
                </td>
              </tr>
            ))}
            {data.tools.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No tools found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectsAdmin() {
  const { data: clientsData } = usePortalClients();
  const { data: toolsData } = usePortalTools();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const projects = useAdminProjects();
  const [, navigate] = useLocation();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const requestedToolId = new URLSearchParams(window.location.search).get('toolId') ?? '';
  const [toolId, setToolId] = useState(requestedToolId);
  const lockedTool = requestedToolId ? toolsData?.tools.find(tool => tool.publicId === requestedToolId) : undefined;
  
  const isReady = clientsData && toolsData;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !toolId) return;
    createMutation.mutate({ name, description, clientId, toolId, status: 'Active', active: true }, {
      onSuccess: ({ project }) => {
        setName('');
        setDescription('');
        navigate(`/portal/projects/${project.publicId}`);
      }
    });
  };

  if (!isReady) {
    return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div>
      <div className="border-b border-border bg-muted/20 px-6 py-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">Create Project</h2>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Client</label>
            <select 
               value={clientId} onChange={e => setClientId(e.target.value)} required
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
               <option value="" disabled>Select Client</option>
                {clientsData.clients.filter(client => client.active).map(c => <option key={c.publicId} value={c.publicId}>{c.name}</option>)}
            </select>
          </div>
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tool</label>
             {lockedTool ? (
               <div className="flex h-[38px] items-center rounded-md border border-primary/30 bg-primary/5 px-3 text-sm font-medium text-foreground">
                 {lockedTool.name}
               </div>
             ) : (
               <select
                  value={toolId} onChange={e => setToolId(e.target.value)} required
                 className="w-full rounded-md border border-border px-3 py-2 text-sm"
               >
                  <option value="" disabled>Select Tool</option>
                  {toolsData.tools.filter(tool => tool.active).map(t => <option key={t.publicId} value={t.publicId}>{t.name}</option>)}
               </select>
             )}
          </div>
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Project Name</label>
            <input 
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm" placeholder="Alpha Release"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <input 
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm" placeholder="Optional"
            />
          </div>
          <div className="lg:col-span-1">
            <button 
              type="submit" disabled={createMutation.isPending || !clientId || !toolId}
              className="flex h-[38px] w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Client</th>
              <th className="px-6 py-3 font-medium">Tool</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projects.data?.projects.map(project => (
              <tr key={project.publicId}>
                <td className="px-6 py-4 font-medium">{project.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{clientsData.clients.find(client => client.publicId === project.clientId)?.name ?? '—'}</td>
                <td className="px-6 py-4 text-muted-foreground">{toolsData.tools.find(tool => tool.publicId === project.toolId)?.name ?? '—'}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => updateMutation.mutate({ id: project.publicId, data: { active: !project.active } })}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${project.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                  >{project.active ? project.status : 'Inactive'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditAdmin() {
  const { data, isLoading } = useAdminAudit();

  if (isLoading || !data) {
    return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-6 py-3 font-medium">Time</th>
            <th className="px-6 py-3 font-medium">Actor</th>
            <th className="px-6 py-3 font-medium">Action</th>
            <th className="px-6 py-3 font-medium">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.logs.map(log => (
            <tr key={`${log.createdAt}-${log.action}`}>
              <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-foreground">Administrator</td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                  {log.action}
                </span>
              </td>
              <td className="px-6 py-4 text-muted-foreground text-xs">
                {log.previousValue && `From: ${log.previousValue} `}
                {log.newValue && `To: ${log.newValue}`}
              </td>
            </tr>
          ))}
          {data.logs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No audit logs found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const RUNNING_STATES = new Set(['running', 'queued', 'pending', 'in_progress', 'refreshing']);

function FirmDataPanel() {
  const queryClient = useQueryClient();
  const status = useGetFirmBenchmarkStatus({
    query: {
      queryKey: getGetFirmBenchmarkStatusQueryKey(),
      refetchInterval: (query) => (RUNNING_STATES.has(String(query.state.data?.state ?? '').toLowerCase()) ? 10_000 : false),
    },
  });
  const refresh = useMutation({
    mutationFn: () => fetchPortal<FirmBenchmarkStatus>('/admin/firm-benchmark/refresh', { method: 'POST' }),
    onSuccess: (next) => {
      queryClient.setQueryData(getGetFirmBenchmarkStatusQueryKey(), next);
      queryClient.invalidateQueries({ queryKey: getGetFirmBenchmarkStatusQueryKey() });
    },
  });
  const data = status.data;
  const running = !!data && RUNNING_STATES.has(data.state.toLowerCase());
  const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : 'Never');
  const pct = data && data.totalCustomerNumbers > 0 ? Math.min(100, (data.completedCustomerNumbers / data.totalCustomerNumbers) * 100) : 0;

  return (
    <section className="mb-6 rounded-2xl border border-border bg-white p-5 shadow-sm" data-testid="panel-firm-data">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Database className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Firm data</h2>
            <p className="text-sm text-muted-foreground">Zilka-Kotab benchmark dataset used by the public portfolio tool. Refresh runs in the background and does not block public analyses.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refresh.mutate()}
          disabled={running || refresh.isPending || status.isLoading}
          className="flex h-[38px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          data-testid="button-refresh-firm-data"
        >
          <RefreshCw className={`h-4 w-4 ${running || refresh.isPending ? 'animate-spin' : ''}`} /> Refresh firm data
        </button>
      </div>
      {status.isLoading && <div className="mt-4 h-10 animate-pulse rounded-md bg-muted" />}
      {status.isError && <p className="mt-4 text-sm text-destructive" data-testid="text-firm-data-load-error">Firm data status could not be loaded. <button type="button" className="underline" onClick={() => status.refetch()} data-testid="button-retry-firm-data">Retry</button></p>}
      {refresh.isError && <p className="mt-3 text-sm text-destructive" data-testid="text-firm-data-refresh-error">Refresh could not be started. {refresh.error instanceof Error ? refresh.error.message : ''}</p>}
      {data && (
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-4">
          <div><div className="text-xs uppercase text-muted-foreground">State</div><div className="mt-1 font-medium capitalize" data-testid="status-firm-data">{data.state.replace(/_/g, ' ')}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground">Applications</div><div className="mt-1 font-medium tabular-nums" data-testid="text-firm-data-applications">{data.applicationCount.toLocaleString()}</div></div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Customer numbers</div>
            <div className="mt-1 font-medium tabular-nums" data-testid="text-firm-data-progress">{data.completedCustomerNumbers} of {data.totalCustomerNumbers} customers</div>
            <div className="mt-1.5 h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">{running ? 'Started' : data.error ? 'Last attempt' : 'Last successful refresh'}</div>
            <div className="mt-1 font-medium" data-testid="text-firm-data-completed">{running ? fmt(data.startedAt) : fmt(data.completedAt)}</div>
          </div>
          {data.error && <p className="md:col-span-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" data-testid="text-firm-data-error">Last refresh error: {data.error}</p>}
        </div>
      )}
    </section>
  );
}
