import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api-portal";

const fields = [
  ["externalTaskId", "Stable external task ID", true],
  ["matterId", "AppColl MatterID or matter reference", true],
  ["title", "Task type / title", true],
  ["description", "Task comments", false],
  ["officialDueDate", "Official due date", false],
  ["status", "Task status", false],
  ["assignedPractitioner", "Assigned practitioner", false],
  ["completedDate", "Completion date", false],
] as const;

export default function InternalWorkflowDocketTasks({ canImport }: { canImport: boolean }) {
  const client = useQueryClient();
  const tasks = useQuery({ queryKey: ["portal", "importedDocketTasks"], queryFn: api.getImportedDocketTasks });
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.previewDocketTaskImport>> | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [search, setSearch] = useState("");
  const importedTasks = tasks.data?.tasks ?? [];
  const openTasks = importedTasks.filter((task) => !task.completedDate && !/closed|complete|cancel/i.test(task.status));
  const dueDateFor = (task: typeof importedTasks[number]) => task.officialDueDate || task.rawRecord.FinalDueDate || "";
  const overdueTasks = openTasks.filter((task) => dueDateFor(task) && dueDateFor(task) < new Date().toISOString().slice(0, 10));
  const owners = [...new Set(importedTasks.map((task) => task.assignedPractitioner).filter(Boolean))].sort();
  const clients = [...new Set(importedTasks.map((task) => task.matter.client).filter(Boolean))].sort();
  const visibleTasks = useMemo(() => importedTasks.filter((task) => {
    const completed = !!task.completedDate || /closed|complete|cancel/i.test(task.status);
    if (statusFilter === "open" && completed) return false;
    if (statusFilter === "completed" && !completed) return false;
    if (ownerFilter !== "all" && task.assignedPractitioner !== ownerFilter) return false;
    if (clientFilter !== "all" && task.matter.client !== clientFilter) return false;
    const text = `${task.externalTaskId} ${task.title} ${task.matter.docketId} ${task.matter.title} ${task.matter.client} ${task.assignedPractitioner} ${task.status}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  }), [importedTasks, statusFilter, ownerFilter, clientFilter, search]);
  const inspect = useMutation({ mutationFn: api.getDocketTaskImportHeaders, onSuccess: ({ headers: next }) => {
    setHeaders(next);
    const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const aliases: Record<string, string[]> = {
      externalTaskId: ["externaltaskid", "taskid", "dockettaskid", "id"],
      matterId: ["matterid", "appcollmatterid", "matter", "attorneyref", "matterreference"], title: ["title", "tasktitle", "taskname", "tasktype"],
      description: ["description", "taskdescription", "comments", "discussion"], officialDueDate: ["respondby", "duedate", "officialduedate", "deadline"],
      status: ["status", "taskstatus"], assignedPractitioner: ["owner", "assignedpractitioner", "assignedto", "attorney", "paralegal"],
      completedDate: ["completeddate", "completiondate", "closeddate", "closedon"],
    };
    const suggested: Record<string, string> = {};
    for (const [key, names] of Object.entries(aliases)) {
      const found = next.find((header) => names.includes(normalized(header)));
      if (found) suggested[key] = found;
    }
    setMapping(suggested);
  }});
  const previewMutation = useMutation({ mutationFn: api.previewDocketTaskImport, onSuccess: setPreview, onError: (reason) => setError(reason instanceof Error ? reason.message : "Preview failed.") });
  const apply = useMutation({ mutationFn: api.applyDocketTaskImport, onSuccess: async () => {
    setPreview(null); setFileName(""); setCsvText(""); setHeaders([]); setMapping({});
    await client.invalidateQueries({ queryKey: ["portal", "importedDocketTasks"] });
  }, onError: (reason) => setError(reason instanceof Error ? reason.message : "Import failed.") });
  const selectFile = async (file?: File) => {
    if (!file) return;
    setError(""); setPreview(null); setFileName(file.name);
    const text = await file.text(); setCsvText(text); inspect.mutate(text);
  };
  return <section className="mx-auto max-w-[1440px] space-y-6 px-4 pb-10 sm:px-6 lg:px-9">
    <header><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">AppColl task queue</p><h2 className="mt-1 text-2xl font-semibold">Official docket tasks</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Import AppColl’s task export to review owners, task types, response dates, final due dates, and completion status. Import the matter export first so task matter references can be linked.</p></header>
    {canImport && <div className="rounded-xl border bg-card p-5">
      <label className="block text-sm font-semibold">Choose a task CSV<input type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm" onChange={(event) => { void selectFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
      {fileName && <p className="mt-2 text-xs text-muted-foreground">{fileName}</p>}
      {headers.length > 0 && <><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields.map(([key, label, required]) => <label key={key} className="text-xs font-medium">{label}{required && " *"}<select value={mapping[key] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block h-10 w-full rounded-lg border bg-background px-2 text-sm"><option value="">Not mapped</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>
        <button disabled={previewMutation.isPending || !mapping.externalTaskId || !mapping.matterId || !mapping.title} onClick={() => { setError(""); previewMutation.mutate({ fileName, csvText, mapping }); }} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Preview mapped tasks</button>
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      {preview && <div className="mt-5 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2 text-xs">{Object.entries(preview.preview.summary).map(([key, count]) => <span key={key} className="rounded-full bg-muted px-2.5 py-1">{key}: {count}</span>)}</div><button disabled={apply.isPending || preview.preview.summary.added + preview.preview.summary.changed + preview.preview.summary.unchanged === 0} onClick={() => apply.mutate(preview.preview.publicId)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Apply valid tasks</button></div>
        <div className="mt-3 max-h-72 overflow-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{["ID", "Title", "Matter", "Official due", "Result"].map((heading) => <th key={heading} className="p-2">{heading}</th>)}</tr></thead><tbody>{preview.rows.map((row) => <tr key={`${row.row}-${row.externalTaskId}`} className="border-t"><td className="p-2">{row.externalTaskId || "—"}</td><td className="p-2">{row.title || "—"}</td><td className="p-2">{row.matterId || "—"}</td><td className="p-2">{row.dueDate || "—"}</td><td className="p-2">{row.disposition}{row.detail && <small className="block text-muted-foreground">{row.detail}</small>}</td></tr>)}</tbody></table></div>
        {preview.preview.summary.invalid > 0 && <p className="mt-2 text-xs text-amber-800">Resolve invalid rows in AppColl and upload a corrected export; this batch cannot be applied while rows are invalid.</p>}
      </div>}
    </div>}
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Open tasks", openTasks.length], ["Overdue", overdueTasks.length], ["Completed", importedTasks.length - openTasks.length]].map(([label, value]) => <article key={String(label)} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></article>)}
    </div>
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-4"><h3 className="font-semibold">AppColl task list</h3><p className="text-xs text-muted-foreground">Official task details remain sourced from AppColl; internal assignments are managed in Work queue.</p></div>
      <div className="grid gap-2 border-b bg-muted/20 p-3 md:grid-cols-4">
        <input aria-label="Search AppColl tasks" placeholder="Search tasks, matters, owner…" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm" />
        <select aria-label="Filter task status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="open">Open tasks</option><option value="completed">Completed tasks</option><option value="all">All tasks</option></select>
        <select aria-label="Filter by owner" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="all">All owners</option>{owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select>
        <select aria-label="Filter by client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="all">All clients</option>{clients.map((client) => <option key={client} value={client}>{client}</option>)}</select>
      </div>
      {tasks.isLoading ? <p className="p-5 text-sm">Loading AppColl tasks…</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-muted/40 text-xs"><tr>{["Task type / ID", "Matter / client", "Owner", "Respond by", "Final due", "Deadline type", "Status"].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead><tbody>{visibleTasks.map((task) => {
        const finalDue = task.rawRecord.FinalDueDate || "";
        const deadlineType = task.rawRecord.DeadlineType || "";
        const isOverdue = !task.completedDate && dueDateFor(task) && dueDateFor(task) < new Date().toISOString().slice(0, 10);
        return <tr key={task.publicId} className="border-t align-top">
          <td className="p-3"><p className="font-medium">{task.title}</p><small className="text-muted-foreground">Task #{task.externalTaskId}</small>{task.description && <p className="mt-1 max-w-sm whitespace-pre-wrap text-xs text-muted-foreground">{task.description}</p>}</td>
          <td className="p-3"><p>{task.matter.docketId || task.matter.appCollMatterId}</p><small className="text-muted-foreground">{task.matter.client} · {task.matter.title}</small></td>
          <td className="p-3">{task.assignedPractitioner || "—"}</td>
          <td className={`p-3 font-medium ${isOverdue ? "text-rose-700" : ""}`}>{task.officialDueDate || "—"}{task.latestDeadlineChange && <small className="block text-amber-800">Changed from {task.latestDeadlineChange.previousDueDate || "unspecified"}</small>}</td>
          <td className="p-3">{finalDue || "—"}</td><td className="p-3">{deadlineType || "—"}</td>
          <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${task.completedDate || /closed|complete|cancel/i.test(task.status) ? "bg-muted text-muted-foreground" : "bg-emerald-50 text-emerald-800"}`}>{task.status || (task.completedDate ? `Closed ${task.completedDate}` : "Open")}</span></td>
        </tr>;
      })}</tbody></table></div>}
      {!tasks.isLoading && visibleTasks.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{importedTasks.length ? "No tasks match these filters." : "No AppColl tasks have been imported yet."}</p>}
    </section>
  </section>;
}
