import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './api-portal';

// Base keys
export const portalKeys = {
  all: ['portal'] as const,
  access: () => [...portalKeys.all, 'access'] as const,
  dashboard: () => [...portalKeys.all, 'dashboard'] as const,
  clients: () => [...portalKeys.all, 'clients'] as const,
  client: (id: string) => [...portalKeys.clients(), id] as const,
  tools: () => [...portalKeys.all, 'tools'] as const,
  tool: (slug: string) => [...portalKeys.tools(), slug] as const,
  projects: () => [...portalKeys.all, 'projects'] as const,
  project: (id: string) => [...portalKeys.projects(), id] as const,
  projectWorkspace: (id: string, includeArchived = false) => [...portalKeys.project(id), 'workspace', includeArchived ? 'archived' : 'active'] as const,
  patent: (id: string) => [...portalKeys.all, 'patent', id] as const,
  adminUsers: () => [...portalKeys.all, 'adminUsers'] as const,
  adminAudit: () => [...portalKeys.all, 'adminAudit'] as const,
  adminProjects: () => [...portalKeys.all, 'adminProjects'] as const,
  adminToolAccess: () => [...portalKeys.all, 'adminToolAccess'] as const,
  adminClientTools: () => [...portalKeys.all, 'adminClientTools'] as const,
  internalWorkflow: () => [...portalKeys.all, 'internalWorkflow'] as const,
};

export function usePortalAccess(enabled = true) {
  return useQuery({
    queryKey: portalKeys.access(),
    queryFn: api.getPortalUser,
    enabled,
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

export function usePortalClient(id: string) {
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

export function useInternalWorkflow() {
  return useQuery({
    queryKey: portalKeys.internalWorkflow(),
    queryFn: async () => {
      const [matters, imports] = await Promise.all([api.getInternalWorkflowMatters(), api.getInternalWorkflowImports()]);
      return { matters: matters.matters, imports: imports.imports };
    },
  });
}

export function usePreviewInternalWorkflowImport() {
  return useMutation({ mutationFn: api.previewInternalWorkflowImport });
}

export function useApplyInternalWorkflowImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.applyInternalWorkflowImport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.internalWorkflow() }),
  });
}

export function usePortalTool(slug: string) {
  return useQuery({
    queryKey: portalKeys.tool(slug),
    queryFn: () => api.getTool(slug),
    enabled: !!slug,
  });
}

export function usePortalProject(id: string) {
  return useQuery({
    queryKey: portalKeys.project(id),
    queryFn: () => api.getProject(id),
    enabled: !!id,
  });
}

export function useProjectWorkspace(id: string, includeArchived = false) {
  return useQuery({ queryKey: portalKeys.projectWorkspace(id, includeArchived), queryFn: () => api.getProjectWorkspace(id, includeArchived), enabled: !!id });
}

export function useRefreshPatent(patentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.refreshPatent(patentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.patent(patentId) });
      queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
}

function useWorkspaceMutation<T>(projectId: string, mutationFn: (data: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalKeys.projectWorkspace(projectId) }),
  });
}

export const useCreateWorkspaceItem = (projectId: string) =>
  useWorkspaceMutation(projectId, (data: Parameters<typeof api.createWorkspaceItem>[1]) => api.createWorkspaceItem(projectId, data));
export const useCreateManualAnalysis = (projectId: string) =>
  useWorkspaceMutation(projectId, (data: Parameters<typeof api.createManualAnalysis>[1]) => api.createManualAnalysis(projectId, data));
export const useCreatePatent = (projectId: string) =>
  useWorkspaceMutation(projectId, (data: Parameters<typeof api.createPatent>[1]) => api.createPatent(projectId, data));
export const usePreviewPatentImport = (projectId: string) =>
  useMutation({ mutationFn: (patentNumbers: string) => api.previewPatentImport(projectId, patentNumbers) });
export const useSearchPatentsByAssignee = (projectId: string) =>
  useMutation({ mutationFn: (input: Parameters<typeof api.searchPatentsByAssignee>[1]) => api.searchPatentsByAssignee(projectId, input) });
export const useCommitPatentImport = (projectId: string) =>
  useWorkspaceMutation(projectId, ({ draftId, selectedClaimNumbers }: { draftId: string; selectedClaimNumbers: string[] }) =>
    api.commitPatentImport(draftId, selectedClaimNumbers));
export const useUpdatePatentMonitoring = (patentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => api.updatePatentMonitoring(patentId, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.patent(patentId) });
      queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
};
export const useBulkUpdatePatents = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.bulkUpdatePatents>[1]) => api.bulkUpdatePatents(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.projectWorkspace(projectId) });
      queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
};
export const useBulkDeletePatents = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patentIds: string[]) => api.bulkDeletePatents(projectId, patentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.projectWorkspace(projectId, true) });
      queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
};
export const useUpdatePatentAttorneyNotes = (patentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: string) => api.updatePatentAttorneyNotes(patentId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.patent(patentId) });
      queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
};
export const useUpdateClaimMonitoringSelection = (patentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (selectedClaimNumbers: string[]) => api.updateClaimMonitoringSelection(patentId, selectedClaimNumbers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.patent(patentId) });
      queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
};
export const useUpdatePatentArchive = (patentId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archived: boolean) => api.updatePatentArchive(patentId, archived),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.patent(patentId) });
      queryClient.invalidateQueries({ queryKey: portalKeys.all });
    },
  });
};
export const useCreateAnalysisReview = (projectId: string) =>
  useWorkspaceMutation(projectId, ({ runId, data }: { runId: string; data: Parameters<typeof api.createAnalysisReview>[1] }) => api.createAnalysisReview(runId, data));
export const useUpdateProjectAiConfig = (projectId: string) =>
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
    mutationFn: ({ id, data }: { id: string; data: Partial<api.PortalUser> }) => api.updateAdminUser(id, data),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Client> }) => api.updateAdminClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.clients() });
    },
  });
}

export function useUpdateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Tool> }) => api.updateTool(id, data),
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
    mutationFn: ({ clientId, toolIds }: { clientId: string; toolIds: string[] }) => api.setClientTools(clientId, toolIds),
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
      queryClient.invalidateQueries({ queryKey: portalKeys.clients() });
      queryClient.invalidateQueries({ queryKey: portalKeys.tools() });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.Project> }) => api.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.projects() });
      queryClient.invalidateQueries({ queryKey: portalKeys.adminProjects() });
      queryClient.invalidateQueries({ queryKey: portalKeys.dashboard() });
    },
  });
}
