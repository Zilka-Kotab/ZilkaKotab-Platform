export type Role = 'CLIENT' | 'ATTORNEY' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'DEACTIVATED';

export interface PortalUser {
  publicId: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  active: boolean;
  clientAssignments: string[]; // Client public IDs
}

export interface Client {
  publicId: string;
  name: string;
  active: boolean;
}

export interface Tool {
  publicId: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
}

export interface Project {
  publicId: string;
  clientId: string;
  toolId: string;
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
  projectId: string;
  selectedProvider: AiProcessingProvider;
  allowedProviders: AiProcessingProvider[];
}

export interface PatentClaim {
  publicId: string;
  patentId: string;
  claimNumber: string;
  version: number;
  claimText: string;
  claimType: 'INDEPENDENT' | 'DEPENDENT' | 'UNKNOWN';
  dependsOnClaimNumber?: string | null;
  source: string;
  sourceIdentifier?: string | null;
  retrievedAt?: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'MANUALLY_CORRECTED';
  selectedForMonitoring: boolean;
  createdAt: string;
}

export interface MonitoredPatent {
  publicId: string;
  projectId: string;
  patentNumber: string;
  title: string;
  applicationNumber?: string | null;
  filingDate?: string | null;
  issueDate?: string | null;
  earliestPriorityDate?: string | null;
  assignee?: string | null;
  inventors: string[];
  abstract?: string | null;
  patentStatus: string;
  jurisdiction: string;
  sourceUrl?: string | null;
  source: string;
  sourceIdentifier?: string | null;
  retrievalMethod: string;
  retrievedAt?: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'MANUALLY_CORRECTED';
  monitoringActive: boolean;
  lastAnalyzedAt?: string | null;
  claims: PatentClaim[];
  createdAt: string;
}

export interface PatentImportDraft {
  publicId: string;
  normalizedPatentNumber: string;
  status: 'READY' | 'FAILED' | 'COMMITTED';
  source: string;
  sourceIdentifier?: string | null;
  sourceUrl?: string | null;
  retrievedAt?: string | null;
  errors: string[];
  patent: {
    normalizedPatentNumber: string;
    title: string;
    applicationNumber: string | null;
    filingDate: string | null;
    issueDate: string | null;
    earliestPriorityDate: string | null;
    assignee: string | null;
    inventors: string[];
    abstract: string | null;
    patentStatus: string;
    jurisdiction: string;
    source: string;
    sourceIdentifier: string;
    sourceUrl: string | null;
    retrievedAt: string;
    claims: Array<{
      claimNumber: string;
      claimText: string;
      claimType: 'INDEPENDENT' | 'DEPENDENT' | 'UNKNOWN';
      dependsOnClaimNumber: string | null;
      selectedForMonitoring: boolean;
    }>;
    errors: string[];
  };
}

export interface PatentDetail {
  patent: MonitoredPatent;
  project: Project;
  client: Client;
  tool: Tool;
  analysisRuns: AnalysisRun[];
}

export interface WorkspaceItem {
  publicId: string;
  projectId: string;
  title: string;
  itemType: string;
  content: string;
  sourceUrl?: string | null;
  classification: DataClassification;
  createdAt: string;
}

export interface AnalysisReview {
  publicId: string;
  analysisRunId: string;
  status: AnalysisReviewStatus;
  note: string;
  classification: DataClassification;
  createdAt: string;
}

export interface AnalysisRun {
  publicId: string;
  projectId: string;
  patentId?: string | null;
  claimId?: string | null;
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
  tool: Tool;
  client: Client;
  aiConfig: ProjectAiConfig;
  patents: MonitoredPatent[];
  workspaceItems: WorkspaceItem[];
  analysisRuns: AnalysisRun[];
}

export interface AuditEntry {
  action: string;
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
export const getClient = (publicId: string) => fetchPortal<{ client: Client, tools: Tool[], projects: Project[] }>(`/clients/${publicId}`);

export const getTools = () => fetchPortal<{ tools: Tool[] }>('/tools');
export const getTool = (slug: string) => fetchPortal<{ tool: Tool, clients: Client[], projects: Project[] }>(`/tools/${slug}`);

export const getProject = (publicId: string) => fetchPortal<{ project: Project, tool: Tool, client: Client }>(`/projects/${publicId}`);
export const getProjectWorkspace = (publicId: string) => fetchPortal<ProjectWorkspace>(`/projects/${publicId}/workspace`);
export const getPatent = (publicId: string) => fetchPortal<PatentDetail>(`/patents/${publicId}`);
export const createWorkspaceItem = (projectId: string, data: Pick<WorkspaceItem, 'title' | 'itemType' | 'content' | 'classification'> & { sourceUrl?: string }) =>
  fetchPortal<{ item: WorkspaceItem }>(`/projects/${projectId}/workspace-items`, { method: 'POST', body: JSON.stringify(data) });
export const createManualAnalysis = (projectId: string, data: { summary: string; triage: AnalysisTriage; patentId?: string; claimId?: string }) =>
  fetchPortal<{ run: AnalysisRun }>(`/projects/${projectId}/analysis-runs`, { method: 'POST', body: JSON.stringify(data) });
export const previewPatentImport = (projectId: string, patentNumbers: string) =>
  fetchPortal<{ drafts: PatentImportDraft[] }>(`/projects/${projectId}/patent-imports/preview`, { method: 'POST', body: JSON.stringify({ patentNumbers }) });
export const commitPatentImport = (draftId: string, selectedClaimNumbers: string[]) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/patent-imports/${draftId}/commit`, { method: 'POST', body: JSON.stringify({ selectedClaimNumbers }) });
export const createPatent = (projectId: string, data: { patentNumber: string; title: string; jurisdiction: string; sourceUrl?: string; claims?: unknown[] }) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/projects/${projectId}/patents`, { method: 'POST', body: JSON.stringify(data) });
export const updatePatentMonitoring = (publicId: string, active: boolean) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/patents/${publicId}/monitoring`, { method: 'PATCH', body: JSON.stringify({ active }) });
export const createAnalysisReview = (runId: string, data: { status: AnalysisReviewStatus; note?: string }) =>
  fetchPortal<{ review: AnalysisReview }>(`/analysis-runs/${runId}/reviews`, { method: 'POST', body: JSON.stringify(data) });
export const updateProjectAiConfig = (projectId: string, data: Pick<ProjectAiConfig, 'selectedProvider' | 'allowedProviders'>) =>
  fetchPortal<{ aiConfig: ProjectAiConfig }>(`/projects/${projectId}/ai-config`, { method: 'PUT', body: JSON.stringify(data) });

// Admin Queries
export const getAdminUsers = () => fetchPortal<{ users: PortalUser[] }>('/admin/users');
export const getAdminAuditLogs = () => fetchPortal<{ logs: AuditEntry[] }>('/admin/audit');
export const getAdminProjects = () => fetchPortal<{ projects: Project[] }>('/admin/projects');
export const getAdminToolAccess = () => fetchPortal<{ access: { toolId: string; clientId: string; clientName: string }[] }>('/admin/tool-access');
export const getAdminClientTools = () => fetchPortal<{ assignments: { clientId: string; toolId: string }[] }>('/admin/client-tools');

// Admin Mutations
export const createAdminUser = (data: Partial<PortalUser>) => fetchPortal<{ user: PortalUser }>('/admin/users', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminUser = (publicId: string, data: Partial<PortalUser>) => fetchPortal<{ user: PortalUser }>(`/admin/users/${publicId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const createAdminClient = (data: Partial<Client>) => fetchPortal<{ client: Client }>('/admin/clients', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminClient = (publicId: string, data: Partial<Client>) => fetchPortal<{ client: Client }>(`/admin/clients/${publicId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const updateTool = (publicId: string, data: Partial<Tool>) => fetchPortal<{ tool: Tool }>(`/admin/tools/${publicId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const createTool = (data: Partial<Tool>) => fetchPortal<{ tool: Tool }>('/admin/tools', { method: 'POST', body: JSON.stringify(data) });
export const setClientTools = (clientId: string, toolIds: string[]) => fetchPortal<{ success: true }>(`/admin/clients/${clientId}/tools`, { method: 'PUT', body: JSON.stringify({ toolIds }) });
export const createProject = (data: Partial<Project>) => fetchPortal<{ project: Project }>('/admin/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (publicId: string, data: Partial<Project>) => fetchPortal<{ project: Project }>(`/admin/projects/${publicId}`, { method: 'PATCH', body: JSON.stringify(data) });
