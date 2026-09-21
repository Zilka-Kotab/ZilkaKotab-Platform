export type Role = 'CLIENT' | 'ATTORNEY' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DEACTIVATED';

export interface PortalUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  active: boolean;
  clientAssignments: number[]; // Client IDs
}

export interface Client {
  id: number;
  name: string;
  active: boolean;
}

export interface Tool {
  id: number;
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

export interface Project {
  id: number;
  clientId: number;
  toolId: number;
  name: string;
  description: string;
  status: string;
  active: boolean;
}

export type AiProcessingProvider = 'CLIENT_MICROSOFT' | 'ZK_MANAGED_AI' | 'MANUAL';
export type DataClassification = 'PUBLIC_SOURCE' | 'CLIENT_CONFIDENTIAL' | 'ATTORNEY_WORK_PRODUCT';
export type AnalysisTriage = 'HIGH' | 'MEDIUM' | 'LOW';
export type AnalysisReviewStatus = 'UNREVIEWED' | 'CLIENT_REVIEWED' | 'ATTORNEY_REVIEWED' | 'FINAL';

export interface ProjectAiConfig {
  projectId: number;
  selectedProvider: AiProcessingProvider;
  allowedProviders: AiProcessingProvider[];
}

export interface PatentClaim {
  id: number;
  patentId: number;
  claimNumber: string;
  version: number;
  claimText: string;
  createdAt: string;
}

export interface MonitoredPatent {
  id: number;
  projectId: number;
  patentNumber: string;
  title: string;
  jurisdiction: string;
  sourceUrl?: string | null;
  claims: PatentClaim[];
  createdAt: string;
}

export interface WorkspaceItem {
  id: number;
  projectId: number;
  title: string;
  itemType: string;
  content: string;
  sourceUrl?: string | null;
  classification: DataClassification;
  createdAt: string;
}

export interface AnalysisReview {
  id: number;
  analysisRunId: number;
  status: AnalysisReviewStatus;
  note: string;
  classification: DataClassification;
  createdAt: string;
}

export interface AnalysisRun {
  id: number;
  projectId: number;
  patentId?: number | null;
  claimId?: number | null;
  provider: AiProcessingProvider;
  triage: AnalysisTriage;
  reviewStatus: AnalysisReviewStatus;
  summary: string;
  limitationAnalysis: unknown[];
  evidence: unknown[];
  createdAt: string;
  reviews: AnalysisReview[];
}

export interface ProjectWorkspace {
  project: Project;
  aiConfig: ProjectAiConfig;
  patents: MonitoredPatent[];
  workspaceItems: WorkspaceItem[];
  analysisRuns: AnalysisRun[];
}

export interface AuditEntry {
  id: number;
  adminId: number;
  action: string;
  affectedUserId?: number;
  affectedClientId?: number;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
}

const BASE_URL = '/api/portal';
const csrfToken = () => document.cookie
  .split('; ')
  .find((item) => item.startsWith('zk_csrf='))
  ?.split('=')
  .slice(1)
  .join('=');

export async function fetchPortal<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() ?? 'GET';
  const csrf = !['GET', 'HEAD', 'OPTIONS'].includes(method) ? csrfToken() : undefined;
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}),
      ...options?.headers,
    },
    credentials: 'include',
  });
  
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'API request failed');
  }
  return body as T;
}

// Queries
export const getPortalUser = () => fetchPortal<{ user: PortalUser | null }>('/access');
export const getDashboard = () => fetchPortal<{ tools: Tool[], projects: Project[], clients?: Client[] }>('/dashboard');

export const getClients = () => fetchPortal<{ clients: Client[] }>('/clients');
export const getClient = (id: number) => fetchPortal<{ client: Client, tools: Tool[], projects: Project[] }>(`/clients/${id}`);

export const getTools = () => fetchPortal<{ tools: Tool[] }>('/tools');
export const getTool = (slug: string) => fetchPortal<{ tool: Tool, clients: Client[], projects: Project[] }>(`/tools/${slug}`);

export const getProject = (id: number) => fetchPortal<{ project: Project, tool: Tool, client: Client }>(`/projects/${id}`);
export const getProjectWorkspace = (id: number) => fetchPortal<ProjectWorkspace>(`/projects/${id}/workspace`);
export const createWorkspaceItem = (projectId: number, data: Pick<WorkspaceItem, 'title' | 'itemType' | 'content' | 'classification'> & { sourceUrl?: string }) =>
  fetchPortal<{ item: WorkspaceItem }>(`/projects/${projectId}/workspace-items`, { method: 'POST', body: JSON.stringify(data) });
export const createManualAnalysis = (projectId: number, data: { summary: string; triage: AnalysisTriage; patentId?: number; claimId?: number }) =>
  fetchPortal<{ run: AnalysisRun }>(`/projects/${projectId}/analysis-runs`, { method: 'POST', body: JSON.stringify(data) });
export const createPatent = (projectId: number, data: { patentNumber: string; title: string; jurisdiction: string; sourceUrl?: string }) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/projects/${projectId}/patents`, { method: 'POST', body: JSON.stringify(data) });
export const createAnalysisReview = (runId: number, data: { status: AnalysisReviewStatus; note?: string }) =>
  fetchPortal<{ review: AnalysisReview }>(`/analysis-runs/${runId}/reviews`, { method: 'POST', body: JSON.stringify(data) });
export const updateProjectAiConfig = (projectId: number, data: Pick<ProjectAiConfig, 'selectedProvider' | 'allowedProviders'>) =>
  fetchPortal<{ aiConfig: ProjectAiConfig }>(`/projects/${projectId}/ai-config`, { method: 'PUT', body: JSON.stringify(data) });

// Admin Queries
export const getAdminUsers = () => fetchPortal<{ users: PortalUser[] }>('/admin/users');
export const getAdminAuditLogs = () => fetchPortal<{ logs: AuditEntry[] }>('/admin/audit');
export const getAdminProjects = () => fetchPortal<{ projects: Project[] }>('/admin/projects');
export const getAdminToolAccess = () => fetchPortal<{ access: { toolId: number; clientId: number; clientName: string }[] }>('/admin/tool-access');
export const getAdminClientTools = () => fetchPortal<{ assignments: { clientId: number; toolId: number }[] }>('/admin/client-tools');

// Admin Mutations
export const createAdminUser = (data: Partial<PortalUser>) => fetchPortal<{ user: PortalUser }>('/admin/users', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminUser = (id: number, data: Partial<PortalUser>) => fetchPortal<{ user: PortalUser }>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const createAdminClient = (data: Partial<Client>) => fetchPortal<{ client: Client }>('/admin/clients', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminClient = (id: number, data: Partial<Client>) => fetchPortal<{ client: Client }>(`/admin/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const updateTool = (id: number, data: Partial<Tool>) => fetchPortal<{ tool: Tool }>(`/admin/tools/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const createTool = (data: Partial<Tool>) => fetchPortal<{ tool: Tool }>('/admin/tools', { method: 'POST', body: JSON.stringify(data) });
export const setClientTools = (clientId: number, toolIds: number[]) => fetchPortal<{ success: true }>(`/admin/clients/${clientId}/tools`, { method: 'PUT', body: JSON.stringify({ toolIds }) });
export const createProject = (data: Partial<Project>) => fetchPortal<{ project: Project }>('/admin/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: number, data: Partial<Project>) => fetchPortal<{ project: Project }>(`/admin/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
