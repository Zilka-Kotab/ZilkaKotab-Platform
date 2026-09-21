import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAdminUsers, useAdminAudit, useAdminProjects, useAdminToolAccess, useAdminClientTools, usePortalClients, usePortalTools, useCreateAdminUser, useUpdateAdminUser, useCreateAdminClient, useUpdateAdminClient, useUpdateTool, useCreateTool, useSetClientTools, useCreateProject, useUpdateProject } from '@/lib/hooks-portal';
import { Loader2, Settings, Users, Building2, Wrench, Briefcase, Activity, Plus } from 'lucide-react';
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
              <tr key={user.id} className="hover:bg-muted/10">
                <td className="px-6 py-4 font-medium text-foreground">{user.name || '—'}</td>
                <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                <td className="px-6 py-4">
                  <select 
                    value={user.role} 
                    onChange={e => updateMutation.mutate({ id: user.id, data: { role: e.target.value as Role } })}
                    disabled={updateMutation.isPending}
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <option value="CLIENT">Client</option>
                    <option value="ATTORNEY">Attorney</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.status}
                    onChange={event => updateMutation.mutate({ id: user.id, data: { status: event.target.value as UserStatus } })}
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
                  ) : (
                    <select
                      multiple
                      value={user.clientAssignments.map(String)}
                      onChange={(event) => updateMutation.mutate({
                        id: user.id,
                        data: { clientAssignments: Array.from(event.currentTarget.selectedOptions, option => Number(option.value)) },
                      })}
                      className="h-20 w-full rounded-md border border-border px-2 py-1 text-xs"
                      aria-label={`Client assignments for ${user.name}`}
                    >
                      {clientsData?.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
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
  const [toolSelections, setToolSelections] = useState<Record<number, number[]>>({});
  
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
              <th className="px-6 py-3 font-medium">ID</th>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.clients.map(client => (
              <tr key={client.id} className="hover:bg-muted/10">
                <td className="px-6 py-4 text-muted-foreground">#{client.id}</td>
                <td className="px-6 py-4 font-medium text-foreground">{client.name}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => updateMutation.mutate({ id: client.id, data: { active: !client.active } })}
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
                      value={(toolSelections[client.id] ?? assignedTools.data?.assignments.filter(item => item.clientId === client.id).map(item => item.toolId) ?? []).map(String)}
                      onChange={(event) => setToolSelections(current => ({
                        ...current,
                        [client.id]: Array.from(event.currentTarget.selectedOptions, option => Number(option.value)),
                      }))}
                      className="h-20 min-w-44 rounded-md border border-border px-2 py-1 text-xs"
                      aria-label={`Tools for ${client.name}`}
                    >
                      {tools.data?.tools.map(tool => <option key={tool.id} value={tool.id}>{tool.name}</option>)}
                    </select>
                    <button
                      onClick={() => setTools.mutate({
                        clientId: client.id,
                        toolIds: toolSelections[client.id] ?? assignedTools.data?.assignments.filter(item => item.clientId === client.id).map(item => item.toolId) ?? [],
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
              <tr key={tool.id} className="hover:bg-muted/10">
                <td className="px-6 py-4 font-medium text-foreground">{tool.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{tool.slug}</td>
                <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">{tool.description}</td>
                <td className="px-6 py-4 text-muted-foreground">
                  {access.data?.access.filter(item => item.toolId === tool.id).map(item => item.clientName).join(', ') || 'None'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => updateMutation.mutate({ id: tool.id, data: { active: !tool.active } })}
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
  const [clientId, setClientId] = useState<number>(0);
  const requestedToolId = Number(new URLSearchParams(window.location.search).get('toolId'));
  const [toolId, setToolId] = useState<number>(requestedToolId > 0 ? requestedToolId : 0);
  const lockedTool = requestedToolId > 0 ? toolsData?.tools.find(tool => tool.id === requestedToolId) : undefined;
  
  const isReady = clientsData && toolsData;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !toolId) return;
    createMutation.mutate({ name, description, clientId, toolId, status: 'Active', active: true }, {
      onSuccess: ({ project }) => {
        setName('');
        setDescription('');
        navigate(`/portal/projects/${project.id}`);
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
              value={clientId} onChange={e => setClientId(Number(e.target.value))} required
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value={0} disabled>Select Client</option>
               {clientsData.clients.filter(client => client.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                 value={toolId} onChange={e => setToolId(Number(e.target.value))} required
                 className="w-full rounded-md border border-border px-3 py-2 text-sm"
               >
                 <option value={0} disabled>Select Tool</option>
                 {toolsData.tools.filter(tool => tool.active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
              <tr key={project.id}>
                <td className="px-6 py-4 font-medium">{project.name}</td>
                <td className="px-6 py-4 text-muted-foreground">#{project.clientId}</td>
                <td className="px-6 py-4 text-muted-foreground">#{project.toolId}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => updateMutation.mutate({ id: project.id, data: { active: !project.active } })}
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
            <th className="px-6 py-3 font-medium">Admin ID</th>
            <th className="px-6 py-3 font-medium">Action</th>
            <th className="px-6 py-3 font-medium">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.logs.map(log => (
            <tr key={log.id} className="hover:bg-muted/10">
              <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-foreground">Admin #{log.adminId}</td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                  {log.action}
                </span>
              </td>
              <td className="px-6 py-4 text-muted-foreground text-xs">
                {log.affectedUserId && `User: #${log.affectedUserId} `}
                {log.affectedClientId && `Client: #${log.affectedClientId} `}
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
