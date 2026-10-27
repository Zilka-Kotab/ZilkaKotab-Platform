export type Role = 'CLIENT' | 'ATTORNEY' | 'PARALEGAL' | 'ADMIN';
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

export interface InternalWorkflowMatter {
  publicId: string; appCollMatterId: string; docketId: string; title: string; matterType: string;
  status: string; responsibleAttorney: string; paralegal: string; client: string; clientReference: string;
  applicationNumber: string; patentNumber: string; ptoStatus: string; nextExternalTask: string;
  nextExternalDueDate: string | null; nextInternalTask: string; nextInternalDueDate: string | null;
  openExternalTaskCount: number; openInternalTaskCount: number; lastImportedAt: string;
}
export interface InternalWorkflowImport {
  publicId: string; fileName: string; status: string; summary: Record<string, number>;
  exceptions: { row: number; field: string; message: string }[]; createdAt: string; appliedAt: string | null;
}
export interface InternalWorkflowPreview {
  preview: { publicId: string; fileName: string; summary: Record<string, number>; exceptions: { row: number; field: string; message: string }[] };
  rows: { id: string; matterNumber: string; title: string; clientName: string; disposition: string; detail: string }[];
  notice: string;
}
export interface InternalWorkflowStaff {
  id: number; publicId: string; name: string; email: string; role: 'ATTORNEY' | 'PARALEGAL' | 'ADMIN';
}
export interface InternalWorkflowTask {
  publicId: string; title: string; instructions: string;
  matter: { publicId: string; docketId: string; title: string; client: string } | null;
  responsibleAttorney: string; createdBy: string; assignedBy: string;
  assignedTo: { publicId: string; name: string };
  assignedToId: number;
  assignedToPublicId: string; assignedByPublicId: string; createdByPublicId: string;
  responsibleAttorneyPublicId: string | null;
  officialDueDate: string | null; internalTargetDate: string | null;
  workflowStatus: string; strategyStatus: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; createdAt: string; finalizedAt: string | null;
  canReassign: boolean;
}
export interface InternalWorkflowTimeEntry {
  publicId: string; taskPublicId?: string; taskTitle: string; workDate: string; minutes: number; narrative: string;
  billable: boolean; billingCode: string; rateCents: number; amountCents: number; approvalStatus: string; exportedAt: string | null;
  canReview?: boolean;
}
export interface InternalWorkflowNotification {
  publicId: string; title: string; message: string; taskId: number | null; readAt: string | null; createdAt: string;
}
export interface InternalWorkflowReport {
  totals: { active: number; overdue: number; pendingBilling: number; approvedCents: number; exportedCents: number };
  byUser: { name: string; role: Role; assigned: number; minutes: number }[];
}
export interface InternalWorkflowTaskDetails {
  comments: { publicId: string; body: string; author: string; createdAt: string }[];
  activity: { action: string; actor: string; details: Record<string, unknown>; createdAt: string }[];
  children: { publicId: string; title: string; assignedTo: string; status: string; internalTargetDate: string | null }[];
  contributors: { userId: number; name: string; allocationCents: number; notes: string }[];
}
export interface ImportedDocketTask {
  publicId: string; externalTaskId: string; title: string; description: string; officialDueDate: string | null; status: string; assignedPractitioner: string; completedDate: string | null;
  matter: { docketId: string; appCollMatterId: string; client: string };
  latestDeadlineChange: { previousDueDate: string | null; nextDueDate: string | null; changedAt: string } | null;
}

export type AiProcessingProvider = 'CLIENT_MICROSOFT' | 'ZK_MANAGED_AI' | 'MANUAL';
export type DataClassification = 'PUBLIC_SOURCE' | 'CLIENT_CONFIDENTIAL' | 'ATTORNEY_WORK_PRODUCT';
export type PatentRecommendation = 'NOT_ANALYZED' | 'MAINTAIN' | 'REVIEW' | 'PRUNE';
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

export interface AttorneyNoteHistoryEntry {
  publicId: string;
  notes: string;
  actor: { publicId: string; name: string } | null;
  createdAt: string;
}

export interface AttorneyNote {
  publicId: string;
  notes: string;
  createdBy: { publicId: string; name: string } | null;
  updatedBy: { publicId: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  history: AttorneyNoteHistoryEntry[];
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
  sourceStatus?: string | null;
  jurisdiction: string;
  sourceUrl?: string | null;
  source: string;
  sourceIdentifier?: string | null;
  retrievalMethod: string;
  retrievedAt?: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'MANUALLY_CORRECTED';
  monitoringActive: boolean;
  recommendation: PatentRecommendation;
  archivedAt?: string | null;
  lastAnalyzedAt?: string | null;
  attorneyNotes?: AttorneyNote | null;
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
    sourceStatus: string;
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

export interface AssigneePatentMatch {
  normalizedPatentNumber: string;
  title: string;
  assignee: string;
  applicationNumber: string | null;
  issueDate: string | null;
  matchSources: Array<
    | { type: 'application'; matchedName: string }
    | { type: 'assignment'; matchedName: string; partyRole: 'ASSIGNEE' | 'ASSIGNOR'; recordedDate: string | null; conveyance: string | null }
  >;
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
export const getInternalWorkflowMatters = () => fetchPortal<{ matters: InternalWorkflowMatter[] }>('/internal-workflow/matters');
export const getInternalWorkflowImports = () => fetchPortal<{ imports: InternalWorkflowImport[] }>('/internal-workflow/imports');
export const previewInternalWorkflowImport = (data: { fileName: string; csvText: string }) =>
  fetchPortal<InternalWorkflowPreview>('/internal-workflow/imports/preview', { method: 'POST', body: JSON.stringify(data) });
export const applyInternalWorkflowImport = (importId: string) =>
  fetchPortal<{ applied: number; summary: Record<string, number> }>(`/internal-workflow/imports/${importId}/apply`, { method: 'POST', body: JSON.stringify({}) });
export const getImportedDocketTasks = () => fetchPortal<{ tasks: ImportedDocketTask[] }>('/internal-workflow/docket-tasks');
export const getDocketTaskImportHeaders = (csvText: string) => fetchPortal<{ headers: string[] }>('/internal-workflow/docket-task-imports/headers', { method: 'POST', body: JSON.stringify({ csvText }) });
export const previewDocketTaskImport = (data: { fileName: string; csvText: string; mapping: Record<string, string> }) => fetchPortal<{ preview: { publicId: string; summary: Record<string, number>; exceptions: { row: number; field: string; message: string }[] }; rows: { row: number; externalTaskId: string; title: string; matterId: string; dueDate: string; disposition: string; detail: string }[] }>('/internal-workflow/docket-task-imports/preview', { method: 'POST', body: JSON.stringify(data) });
export const applyDocketTaskImport = (id: string) => fetchPortal<{ applied: number }>(`/internal-workflow/docket-task-imports/${id}/apply`, { method: 'POST', body: JSON.stringify({}) });
export const getInternalWorkflowTasks = () => fetchPortal<{ tasks: InternalWorkflowTask[] }>('/internal-workflow/tasks');
export const getInternalWorkflowTeam = () => fetchPortal<{ users: InternalWorkflowStaff[] }>('/internal-workflow/team');
export const createInternalWorkflowTask = (data: { title: string; instructions: string; matterPublicId?: string; assignedToId: number; responsibleAttorneyId?: number; officialDueDate?: string; internalTargetDate?: string; priority: string }) =>
  fetchPortal<{ task: { publicId: string } }>('/internal-workflow/tasks', { method: 'POST', body: JSON.stringify(data) });
export const updateInternalWorkflowTask = (data: { taskId: string; workflowStatus?: string; strategyStatus?: string; assignedToId?: number; internalTargetDate?: string }) =>
  fetchPortal<{ updated: boolean }>(`/internal-workflow/tasks/${data.taskId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const getInternalWorkflowComments = (taskId: string) => fetchPortal<{ comments: { publicId: string; body: string; author: string; createdAt: string }[] }>(`/internal-workflow/tasks/${taskId}/comments`);
export const createInternalWorkflowComment = (data: { taskId: string; body: string }) => fetchPortal(`/internal-workflow/tasks/${data.taskId}/comments`, { method: 'POST', body: JSON.stringify({ body: data.body }) });
export const getInternalWorkflowTaskDetails = (taskId: string) => fetchPortal<InternalWorkflowTaskDetails>(`/internal-workflow/tasks/${taskId}/details`);
export const createInternalWorkflowChild = (data: { taskId: string; title: string; assignedToId: number; internalTargetDate?: string; instructions?: string }) => fetchPortal(`/internal-workflow/tasks/${data.taskId}/children`, { method: 'POST', body: JSON.stringify(data) });
export const addInternalWorkflowContributor = (data: { taskId: string; userId: number; allocationCents: number; notes?: string }) => fetchPortal(`/internal-workflow/tasks/${data.taskId}/contributors`, { method: 'POST', body: JSON.stringify(data) });
export const getInternalWorkflowTimeEntries = () => fetchPortal<{ entries: InternalWorkflowTimeEntry[] }>('/internal-workflow/time-entries');
export const createInternalWorkflowTimeEntry = (data: { taskPublicId: string; workDate: string; minutes: number; narrative: string; billable: boolean; billingCode: string; rateCents: number }) => fetchPortal('/internal-workflow/time-entries', { method: 'POST', body: JSON.stringify(data) });
export const reviewInternalWorkflowTimeEntry = (data: { entryId: string; status: 'APPROVED' | 'RETURNED' }) => fetchPortal(`/internal-workflow/time-entries/${data.entryId}/review`, { method: 'PATCH', body: JSON.stringify({ status: data.status }) });
export const getInternalWorkflowTimer = () => fetchPortal<{ timer: { taskPublicId: string; taskTitle: string; state: string; accumulatedSeconds: number; resumedAt: string } | null }>('/internal-workflow/timer');
export const changeInternalWorkflowTimer = (data: { action: 'start' | 'pause' | 'resume' | 'stop'; taskPublicId?: string; rateCents?: number; billingCode?: string }) => fetchPortal('/internal-workflow/timer', { method: 'POST', body: JSON.stringify(data) });
export const getInternalWorkflowReport = () => fetchPortal<InternalWorkflowReport>('/internal-workflow/reports');
export const exportInternalWorkflowBilling = () => fetchPortal<{ csv: string; exported: number }>('/internal-workflow/billing/export', { method: 'POST', body: JSON.stringify({}) });
export const getInternalWorkflowNotifications = () => fetchPortal<{ notifications: InternalWorkflowNotification[] }>('/internal-workflow/notifications');
export const markInternalWorkflowNotificationRead = (publicId: string) => fetchPortal(`/internal-workflow/notifications/${publicId}/read`, { method: 'PATCH', body: JSON.stringify({}) });
export const getDashboard = () => fetchPortal<{ tools: Tool[], projects: Project[], clients?: Client[] }>('/dashboard');

export const getClients = () => fetchPortal<{ clients: Client[] }>('/clients');
export const getClient = (publicId: string) => fetchPortal<{ client: Client, tools: Tool[], projects: Project[] }>(`/clients/${publicId}`);

export const getTools = () => fetchPortal<{ tools: Tool[] }>('/tools');
export const getTool = (slug: string) => fetchPortal<{ tool: Tool, clients: Client[], projects: Project[] }>(`/tools/${slug}`);

export const getProject = (publicId: string) => fetchPortal<{ project: Project, tool: Tool, client: Client }>(`/projects/${publicId}`);
export const getProjectWorkspace = (publicId: string, includeArchived = false) =>
  fetchPortal<ProjectWorkspace>(`/projects/${publicId}/workspace${includeArchived ? '?includeArchived=true' : ''}`);
export const createWorkspaceItem = (projectId: string, data: Pick<WorkspaceItem, 'title' | 'itemType' | 'content' | 'classification'> & { sourceUrl?: string }) =>
  fetchPortal<{ item: WorkspaceItem }>(`/projects/${projectId}/workspace-items`, { method: 'POST', body: JSON.stringify(data) });
export const createManualAnalysis = (projectId: string, data: { summary: string; triage: AnalysisTriage; patentId?: string; claimId?: string }) =>
  fetchPortal<{ run: AnalysisRun }>(`/projects/${projectId}/analysis-runs`, { method: 'POST', body: JSON.stringify(data) });
export const previewPatentImport = (projectId: string, patentNumbers: string) =>
  fetchPortal<{ drafts: PatentImportDraft[] }>(`/projects/${projectId}/patent-imports/preview`, { method: 'POST', body: JSON.stringify({ patentNumbers }) });
export const searchPatentsByAssignee = (
  projectId: string,
  input: { assignee: string; alternateAssignees: string[]; includeAssignments: boolean },
) =>
  fetchPortal<{ results: AssigneePatentMatch[]; truncated: boolean; assignmentSearchTruncated?: boolean }>(`/projects/${projectId}/patents/search-by-assignee`, { method: 'POST', body: JSON.stringify(input) });
export const commitPatentImport = (draftId: string, selectedClaimNumbers: string[]) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/patent-imports/${draftId}/commit`, { method: 'POST', body: JSON.stringify({ selectedClaimNumbers }) });
export const refreshPatent = (publicId: string) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/patents/${publicId}/refresh`, { method: 'POST' });
export const createPatent = (projectId: string, data: { patentNumber: string; title: string; jurisdiction: string; sourceUrl?: string; claims?: unknown[] }) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/projects/${projectId}/patents`, { method: 'POST', body: JSON.stringify(data) });
export const updatePatentMonitoring = (publicId: string, active: boolean) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/patents/${publicId}/monitoring`, { method: 'PATCH', body: JSON.stringify({ active }) });
export const bulkUpdatePatents = (projectId: string, data: { patentIds: string[]; monitoringActive?: boolean; recommendation?: PatentRecommendation }) =>
  fetchPortal<{ updatedCount: number }>(`/projects/${projectId}/patents/bulk`, { method: 'PATCH', body: JSON.stringify(data) });
export const bulkDeletePatents = (projectId: string, patentIds: string[]) =>
  fetchPortal<{ deletedCount: number }>(`/projects/${projectId}/patents/bulk`, { method: 'DELETE', body: JSON.stringify({ patentIds }) });
export const updatePatentAttorneyNotes = (publicId: string, notes: string) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/patents/${publicId}/attorney-notes`, { method: 'PATCH', body: JSON.stringify({ notes }) });
export const updateClaimMonitoringSelection = (publicId: string, selectedClaimNumbers: string[]) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/patents/${publicId}/claims/monitoring-selection`, { method: 'PATCH', body: JSON.stringify({ selectedClaimNumbers }) });
export const updatePatentArchive = (publicId: string, archived: boolean) =>
  fetchPortal<{ patent: MonitoredPatent }>(`/patents/${publicId}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) });
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
