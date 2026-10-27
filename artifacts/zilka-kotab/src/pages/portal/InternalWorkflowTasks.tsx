import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BriefcaseBusiness, CalendarDays, CheckCircle2, Loader2, Plus, RefreshCw } from "lucide-react";
import * as api from "@/lib/api-portal";
import { usePortalAccess, useInternalWorkflowTeam, useInternalWorkflowTasks, useCreateInternalWorkflowTask, useUpdateInternalWorkflowTask } from "@/lib/hooks-portal";
import type { InternalWorkflowMatter } from "@/lib/api-portal";

type QueueTab = "active" | "assigned" | "delegated" | "completed";
const statuses = ["PENDING_WITH_ME", "ASSIGNED_WITH_ANOTHER", "READY_FOR_PROOF", "CLIENT_REVIEW", "READY_FOR_FILING", "FINALIZED"] as const;
const statusLabels: Record<string, string> = {
  PENDING_WITH_ME: "Pending with me", ASSIGNED_WITH_ANOTHER: "Assigned with another",
  READY_FOR_PROOF: "Ready for proof", CLIENT_REVIEW: "Client review", READY_FOR_FILING: "Ready for filing", FINALIZED: "Finalized",
};
const strategyOptions = ["STRATEGY_NEEDED", "STRATEGY_IN_REVIEW", "STRATEGY_APPROVED", "NOT_APPLICABLE"] as const;
const strategyLabels: Record<string, string> = { STRATEGY_NEEDED: "Strategy needed", STRATEGY_IN_REVIEW: "Strategy in review", STRATEGY_APPROVED: "Strategy approved", NOT_APPLICABLE: "Not applicable" };

function TaskComments({ taskId }: { taskId: string }) {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const query = useQuery({ queryKey: ["portal", "task-comments", taskId], queryFn: () => api.getInternalWorkflowComments(taskId) });
  const add = useMutation({ mutationFn: api.createInternalWorkflowComment, onSuccess: () => { setBody(""); void client.invalidateQueries({ queryKey: ["portal", "task-comments", taskId] }); } });
  return <div className="mt-4 border-t pt-3">
    <h4 className="text-xs font-semibold">Comments and activity</h4>
    <div className="mt-2 space-y-2">{query.data?.comments.map((comment) => <p key={comment.publicId} className="rounded-lg bg-muted/50 p-2 text-xs"><strong>{comment.author}</strong> · {new Date(comment.createdAt).toLocaleString()}<br />{comment.body}</p>)}</div>
    <form onSubmit={(event) => { event.preventDefault(); if (body.trim()) add.mutate({ taskId, body: body.trim() }); }} className="mt-3 flex gap-2">
      <input data-testid={`input-comment-${taskId}`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} placeholder="Add a comment" className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-xs" />
      <button data-testid={`button-comment-${taskId}`} disabled={!body.trim() || add.isPending} className="rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">Add</button>
    </form>
  </div>;
}

export default function InternalWorkflowTasks({ matters }: { matters: InternalWorkflowMatter[] }) {
  const access = usePortalAccess();
  const taskQuery = useInternalWorkflowTasks();
  const teamQuery = useInternalWorkflowTeam();
  const createTask = useCreateInternalWorkflowTask();
  const updateTask = useUpdateInternalWorkflowTask();
  const [tab, setTab] = useState<QueueTab>("active");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [matterId, setMatterId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [responsibleAttorneyId, setResponsibleAttorneyId] = useState("");
  const [officialDueDate, setOfficialDueDate] = useState("");
  const [internalTargetDate, setInternalTargetDate] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [formError, setFormError] = useState("");
  const [searchText, setSearchText] = useState("");
  const currentPublicId = access.data?.user?.publicId;
  const tasks = taskQuery.data?.tasks ?? [];
  const team = teamQuery.data?.users ?? [];
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const isCompleted = task.workflowStatus === "FINALIZED";
    if (tab === "completed" ? !isCompleted : isCompleted) return false;
    if (tab === "assigned" && task.assignedToPublicId !== currentPublicId) return false;
    if (tab === "delegated" && !((task.assignedByPublicId === currentPublicId || task.createdByPublicId === currentPublicId) && task.assignedToPublicId !== currentPublicId)) return false;
    const haystack = `${task.title} ${task.matter?.docketId ?? ""} ${task.matter?.title ?? ""} ${task.matter?.client ?? ""}`.toLowerCase();
    return haystack.includes(searchText.trim().toLowerCase());
  }), [tasks, tab, currentPublicId, searchText]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (title.trim().length < 3 || !assignedToId) {
      setFormError("Enter a task title and choose an assignee.");
      return;
    }
    try {
      await createTask.mutateAsync({
        title: title.trim(), instructions, assignedToId: Number(assignedToId),
        responsibleAttorneyId: responsibleAttorneyId ? Number(responsibleAttorneyId) : undefined,
        matterPublicId: matterId || undefined,
        officialDueDate: officialDueDate || undefined,
        internalTargetDate: internalTargetDate || undefined,
        priority,
      });
      setTitle(""); setInstructions(""); setMatterId("");
      setOfficialDueDate(""); setInternalTargetDate(""); setPriority("NORMAL");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The task could not be created.");
    }
  };

  return (
    <section aria-labelledby="internal-tasks-title" className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-6 lg:px-9">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Firm work queue</p>
          <h2 id="internal-tasks-title" className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground">Assignments and tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">Delegated work remains visible in your queue until it is completed.</p>
        </div>
        <button type="button" onClick={() => { void taskQuery.refetch(); }} data-testid="button-refresh-internal-tasks" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground hover:bg-muted">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <form onSubmit={handleCreate} className="h-fit rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Plus className="h-4 w-4" /></span>
            <div><h3 className="font-semibold text-foreground">Create an assignment</h3><p className="text-xs text-muted-foreground">A matter is optional for internal work.</p></div>
          </div>
          <label className="mb-3 block text-xs font-semibold text-foreground">Task title
            <input data-testid="input-task-title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={240} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal outline-none focus:border-primary" placeholder="Prepare draft response" />
          </label>
          <label className="mb-3 block text-xs font-semibold text-foreground">Matter
            <select data-testid="select-task-matter" value={matterId} onChange={(event) => setMatterId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal">
              <option value="">Independent internal task</option>
              {matters.map((matter) => <option key={matter.publicId} value={matter.publicId}>{matter.docketId || matter.appCollMatterId} · {matter.title || matter.client}</option>)}
            </select>
          </label>
          <label className="mb-3 block text-xs font-semibold text-foreground">Assign to
            <select data-testid="select-task-assignee" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} required className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal">
              <option value="">Select a colleague</option>
              {team.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role === "ADMIN" ? "Admin" : person.role === "PARALEGAL" ? "Paralegal" : "Attorney"}</option>)}
            </select>
          </label>
          <label className="mb-3 block text-xs font-semibold text-foreground">Responsible attorney
            <select data-testid="select-task-responsible-attorney" value={responsibleAttorneyId} onChange={(event) => setResponsibleAttorneyId(event.target.value)} required={access.data?.user?.role !== "ATTORNEY"} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal">
              <option value="">{access.data?.user?.role === "ATTORNEY" ? "Current attorney" : "Select responsible attorney"}</option>
              {team.filter((person) => person.role === "ATTORNEY").map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-foreground">Official deadline
              <input data-testid="input-task-official-date" type="date" value={officialDueDate} onChange={(event) => setOfficialDueDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-2 text-xs font-normal" />
            </label>
            <label className="text-xs font-semibold text-foreground">Internal target
              <input data-testid="input-task-target-date" type="date" value={internalTargetDate} onChange={(event) => setInternalTargetDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-2 text-xs font-normal" />
            </label>
          </div>
          <label className="mb-3 block text-xs font-semibold text-foreground">Priority
            <select data-testid="select-task-priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal">
              <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
            </select>
          </label>
          <label className="mb-4 block text-xs font-semibold text-foreground">Instructions
            <textarea data-testid="input-task-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={12000} rows={3} className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm font-normal outline-none focus:border-primary" placeholder="Add context, deliverables, or next steps" />
          </label>
          {(formError || createTask.isError) && <p role="alert" data-testid="error-create-task" className="mb-3 flex gap-2 text-xs text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{formError || "Task creation failed."}</p>}
          <button type="submit" disabled={createTask.isPending || teamQuery.isLoading} data-testid="button-create-task" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create assignment
          </button>
        </form>

        <div className="min-w-0 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap gap-1 border-b border-border p-3">
            {([["active", "All Active"], ["assigned", "Assigned to Me"], ["delegated", "Delegated by Me"], ["completed", "Completed"]] as const).map(([value, label]) => (
              <button key={value} type="button" data-testid={`tab-task-${value}`} onClick={() => setTab(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{label}</button>
            ))}
          </div>
          <div className="border-b p-3"><input data-testid="input-search-work" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search task, matter, or client" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" /></div>
          {updateTask.isError && <p role="alert" data-testid="error-update-task" className="border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">Could not update the assignment. Your access or the task status may have changed.</p>}
          {taskQuery.isLoading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading assignments</div>
            : taskQuery.isError ? <div role="alert" className="p-8 text-sm text-rose-700">Could not load assignments. Try refreshing.</div>
            : visibleTasks.length === 0 ? <div className="px-5 py-12 text-center"><BriefcaseBusiness className="mx-auto h-7 w-7 text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold text-foreground">No tasks in this view</p><p className="mt-1 text-xs text-muted-foreground">New assignments will appear here.</p></div>
            : <ul className="divide-y divide-border">
              {visibleTasks.map((task) => (
                <li key={task.publicId} data-testid={`item-task-${task.publicId}`} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{task.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${task.priority === "URGENT" ? "bg-rose-100 text-rose-800" : task.priority === "HIGH" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>{task.priority}</span>
                      </div>
                      {task.matter && <p className="mt-1 text-xs text-muted-foreground">{task.matter.docketId || "Matter"} · {task.matter.title} · {task.matter.client}</p>}
                      {task.instructions && <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{task.instructions}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">Assigned to <span className="font-semibold text-foreground">{task.assignedTo.name}</span> by {task.assignedBy}</p>
                      {(task.internalTargetDate || task.officialDueDate) && <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />Target: {task.internalTargetDate || task.officialDueDate}{task.internalTargetDate && task.officialDueDate ? ` · Official: ${task.officialDueDate}` : ""}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <select aria-label={`Status for ${task.title}`} data-testid={`select-task-status-${task.publicId}`} value={task.workflowStatus} onChange={(event) => updateTask.mutate({ taskId: task.publicId, workflowStatus: event.target.value })} className="h-9 rounded-lg border border-border bg-background px-2 text-xs font-medium">
                        {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                      </select>
                      <select aria-label={`Strategy for ${task.title}`} data-testid={`select-task-strategy-${task.publicId}`} value={task.strategyStatus} onChange={(event) => updateTask.mutate({ taskId: task.publicId, strategyStatus: event.target.value })} className="h-9 max-w-[175px] rounded-lg border border-border bg-background px-2 text-xs">
                        {strategyOptions.map((status) => <option key={status} value={status}>{strategyLabels[status]}</option>)}
                      </select>
                      {task.canReassign && <select aria-label={`Reassign ${task.title}`} data-testid={`select-task-reassign-${task.publicId}`} value={task.assignedToId} onChange={(event) => updateTask.mutate({ taskId: task.publicId, assignedToId: Number(event.target.value) })} className="h-9 max-w-[175px] rounded-lg border border-border bg-background px-2 text-xs">
                        {team.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>}
                    </div>
                  </div>
                  {task.workflowStatus === "FINALIZED" && <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Finalized</p>}
                  <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-primary">Open task details</summary><TaskComments taskId={task.publicId} /></details>
                </li>
              ))}
            </ul>}
        </div>
      </div>
    </section>
  );
}
