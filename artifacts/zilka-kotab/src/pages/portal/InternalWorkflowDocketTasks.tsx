import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api-portal";

const fields = [
  ["externalTaskId", "Stable external task ID", true],
  ["matterId", "AppColl MatterID", true],
  ["title", "Task title", true],
  ["description", "Task description", false],
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
  const inspect = useMutation({ mutationFn: api.getDocketTaskImportHeaders, onSuccess: ({ headers: next }) => {
    setHeaders(next);
    const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const aliases: Record<string, string[]> = {
      externalTaskId: ["externaltaskid", "taskid", "dockettaskid", "id"],
      matterId: ["matterid", "appcollmatterid"], title: ["title", "tasktitle", "taskname"],
      description: ["description", "taskdescription"], officialDueDate: ["duedate", "officialduedate", "deadline"],
      status: ["status", "taskstatus"], assignedPractitioner: ["assignedpractitioner", "assignedto", "attorney", "paralegal"],
      completedDate: ["completeddate", "completiondate", "closeddate"],
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
    <header><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">AppColl docket tasks</p><h2 className="mt-1 text-2xl font-semibold">Official docket task imports</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Map the export’s stable task ID and MatterID before applying. Imported official deadlines stay separate from internal targets and assignments.</p></header>
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
    <section className="overflow-x-auto rounded-xl border bg-card"><div className="border-b p-4"><h3 className="font-semibold">Imported official tasks</h3><p className="text-xs text-muted-foreground">These are source records, not internal assignments.</p></div>{tasks.isLoading ? <p className="p-5 text-sm">Loading docket tasks…</p> : <table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs"><tr>{["Task", "Matter", "Assigned", "Official deadline", "Status"].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead><tbody>{(tasks.data?.tasks ?? []).map((task) => <tr key={task.publicId} className="border-t"><td className="p-3"><p className="font-medium">{task.title}</p><small className="text-muted-foreground">{task.externalTaskId}</small></td><td className="p-3">{task.matter.docketId || task.matter.appCollMatterId}<small className="block text-muted-foreground">{task.matter.client}</small></td><td className="p-3">{task.assignedPractitioner || "—"}</td><td className="p-3">{task.officialDueDate || "—"}{task.latestDeadlineChange && <small className="block text-amber-800">Changed from {task.latestDeadlineChange.previousDueDate || "unspecified"} on {new Date(task.latestDeadlineChange.changedAt).toLocaleDateString()}</small>}</td><td className="p-3">{task.status || (task.completedDate ? `Completed ${task.completedDate}` : "—")}</td></tr>)}</tbody></table>}{!tasks.isLoading && tasks.data?.tasks.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No docket tasks have been imported.</p>}</section>
  </section>;
}
