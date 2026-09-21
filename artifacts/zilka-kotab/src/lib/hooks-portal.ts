import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './api-portal';

// Base keys
export const portalKeys = {
  all: ['portal'] as const,
  access: () => [...portalKeys.all, 'access'] as const,
  dashboard: () => [...portalKeys.all, 'dashboard'] as const,
  clients: () => [...portalKeys.all, 'clients'] as const,
  client: (id: number) => [...portalKeys.clients(), id] as const,
  tools: () => [...portalKeys.all, 'tools'] as const,
  tool: (slug: string) => [...portalKeys.tools(), slug] as const,
  projects: () => [...portalKeys.all, 'projects'] as const,
  project: (id: number) => [...portalKeys.projects(), id] as const,
  projectWorkspace: (id: number) => [...portalKeys.project(id), 'workspace'] as const,
  adminUsers: () => [...portalKeys.all, 'adminUsers'] as const,
  adminAudit: () => [...portalKeys.all, 'adminAudit'] as const,
  adminProjects: () => [...portalKeys.all, 'adminProjects'] as const,
  adminToolAccess: () => [...portalKeys.all, 'adminToolAccess'] as const,
  adminClientTools: () => [...portalKeys.all, 'adminClientTools'] as const,
};

export function usePortalAccess() {
  return useQuery({
    queryKey: portalKeys.access(),
    queryFn: api.getPortalUser,
    retry: false, // Don't retry on 401/403
  });
}

export function usePortalDashboard() {
  return useQuery({
    queryKey: portalKeys.dashboard(),
    queryFn: api.getDashboard,
  });
}

export function usePortalClients() {
  return useQuery({
    queryKey: portalKeys.clients(),
    queryFn: api.getClients,
  });
}

export function usePortalClient(id: number) {
  return useQuery({
    queryKey: portalKeys.client(id),
    queryFn: () => api.getClient(id),
    enabled: !!id,
  });
}

export function usePortalTools() {
  return useQuery({
    queryKey: portalKeys.tools(),
    queryFn: api.getTools,
  });
}

export function usePortalTool(slug: string) {
  return useQuery({
    queryKey: portalKeys.tool(slug),
    queryFn: () => api.getTool(slug),
    enabled: !!slug,
  });
}

export function usePortalProject(id: number) {
  return useQuery({
    queryKey: portalKeys.project(id),
    queryFn: () => api.getProject(id),
    enabled: !!id,
  });
}

export function useProjectWorkspace(id: number) {
  return useQuery({ queryKey: portalKeys.projectWorkspace(id), queryFn: () => api.getProjectWorkspace(id), enabled: !!id });
}

function useWorkspaceMutation<T>(projectId: number, mutationFn: (data: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.projectWorkspace(projectId) }),
  });
}

export const useCreateWorkspaceItem = (projectId: number) =>
  useWorkspaceMutation(projectId, (data: Parameters<typeof api.createWorkspaceItem>[1]) => api.createWorkspaceItem(projectId, data));
export const useCreateManualAnalysis = (projectId: number) =>
  useWorkspaceMutation(projectId, (data: Parameters<typeof api.createManualAnalysis>[1]) => api.createManualAnalysis(projectId, data));
export const useCreatePatent = (projectId: number) =>
  useWorkspaceMutation(projectId, (data: Parameters<typeof api.createPatent>[1]) => api.createPatent(projectId, data));
export const useCreateAnalysisReview = (projectId: number) =>
  useWorkspaceMutation(projectId, ({ runId, data }: { runId: number; data: Parameters<typeof api.createAnalysisReview>[1] }) => api.createAnalysisReview(runId, data));
export const useUpdateProjectAiConfig = (projectId: number) =>
  useWorkspaceMutation(projectId, (data: Parameters<typeof api.updateProjectAiConfig>[1]) => api.updateProjectAiConfig(projectId, data));

// Admin Hooks
export function useAdminUsers() {
  return useQuery({
    queryKey: portalKeys.adminUsers(),
    queryFn: api.getAdminUsers,
  });
}

export function useAdminAudit() {
  return useQuery({
    queryKey: portalKeys.adminAudit(),
    queryFn: api.getAdminAuditLogs,
  });
}
export function useAdminProjects() {
  return useQuery({ queryKey: portalKeys.adminProjects(), queryFn: api.getAdminProjects });
}
export function useAdminToolAccess() {
  return useQuery({ queryKey: portalKeys.adminToolAccess(), queryFn: api.getAdminToolAccess });
}
export function useAdminClientTools() {
  return useQuery({ queryKey: portalKeys.adminClientTools(), queryFn: api.getAdminClientTools });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.adminUsers() });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<api.PortalUser> }) => api.updateAdminUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.adminUsers() });
    },
  });
}

export function useCreateAdminClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createAdminClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.clients() });
    },
  });
}

export function useUpdateAdminClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<api.Client> }) => api.updateAdminClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.clients() });
    },
  });
}

export function useUpdateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<api.Tool> }) => api.updateTool(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.tools() });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: portalKeys.adminToolAccess() });
      queryClient.invalidateQueries({ queryKey: portalKeys.adminClientTools() });
    },
  });
}
export function useCreateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTool,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.tools() }),
  });
}
export function useSetClientTools() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, toolIds }: { clientId: number; toolIds: number[] }) => api.setClientTools(clientId, toolIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.clients() });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard() });
      queryClient.invalidateQueries({ queryKey: portalKeys.tools() });
      queryClient.invalidateQueries({ queryKey: portalKeys.adminToolAccess() });
      queryClient.invalidateQueries({ queryKey: portalKeys.adminClientTools() });
    },
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.projects() });
      queryClient.invalidateQueries({ queryKey: portalKeys.adminProjects() });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard() });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<api.Project> }) => api.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.projects() });
      queryClient.invalidateQueries({ queryKey: portalKeys.adminProjects() });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard() });
    },
  });
}
