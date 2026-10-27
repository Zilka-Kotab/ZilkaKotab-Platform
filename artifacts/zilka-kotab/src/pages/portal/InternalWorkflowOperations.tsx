import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Bell, Clock3, BarChart3, Check, X } from "lucide-react";
import * as api from "@/lib/api-portal";
import { useInternalWorkflowTasks, usePortalAccess } from "@/lib/hooks-portal";

type Section = "finance" | "management" | "notifications";
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function InternalWorkflowOperations({ section }: { section: Section }) {
  const queryClient = useQueryClient();
  const access = usePortalAccess();
  const tasks = useInternalWorkflowTasks().data?.tasks ?? [];
  const [taskPublicId, setTaskPublicId] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [rate, setRate] = useState("250");
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [narrative, setNarrative] = useState("");
  const [billingCode, setBillingCode] = useState("PROSECUTION");
  const [notice, setNotice] = useState("");
  const entries = useQuery({ queryKey: ["portal", "internalTimeEntries"], queryFn: api.getInternalWorkflowTimeEntries, enabled: section === "finance" });
  const timer = useQuery({ queryKey: ["portal", "internalTimer"], queryFn: api.getInternalWorkflowTimer, enabled: section === "finance", refetchInterval: 15000 });
  const report = useQuery({ queryKey: ["portal", "internalReport"], queryFn: api.getInternalWorkflowReport, enabled: section === "management" });
  const notifications = useQuery({ queryKey: ["portal", "internalNotifications"], queryFn: api.getInternalWorkflowNotifications, enabled: section === "notifications" });
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["portal", "internalTimeEntries"] }),
    queryClient.invalidateQueries({ queryKey: ["portal", "internalTimer"] }),
    queryClient.invalidateQueries({ queryKey: ["portal", "internalReport"] }),
    queryClient.invalidateQueries({ queryKey: ["portal", "internalNotifications"] }),
  ]);
  const addTime = useMutation({ mutationFn: api.createInternalWorkflowTimeEntry, onSuccess: async () => { setNarrative(""); setNotice("Time entry saved for billing review."); await refresh(); } });
  const timerAction = useMutation({ mutationFn: api.changeInternalWorkflowTimer, onSuccess: refresh });
  const review = useMutation({ mutationFn: api.reviewInternalWorkflowTimeEntry, onSuccess: refresh });
  const exportBilling = useMutation({ mutationFn: api.exportInternalWorkflowBilling, onSuccess: async (result) => {
    const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `approved-billing-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    setNotice(`${result.exported} approved entries exported.`); await refresh();
  } });
  const markRead = useMutation({ mutationFn: api.markInternalWorkflowNotificationRead, onSuccess: refresh });
  const handleAddTime = (event: FormEvent) => {
    event.preventDefault();
    if (!taskPublicId) { setNotice("Choose a task before saving time."); return; }
    addTime.mutate({ taskPublicId, workDate, minutes: Number(minutes), narrative, billable: true, billingCode, rateCents: Math.round(Number(rate) * 100) });
  };
  if (section === "finance") {
    const activeTimer = timer.data?.timer;
    return <section className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-9">
      <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Time & billing</p><h2 className="mt-1 text-2xl font-semibold">Timesheet and billing review</h2></div>
      {notice && <p role="status" data-testid="status-finance" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold">Timer</h3>
            {activeTimer ? <><p className="mt-2 text-sm">{activeTimer.taskTitle} · {activeTimer.state.toLowerCase()}</p><div className="mt-3 flex gap-2">
              {activeTimer.state === "RUNNING" ? <button data-testid="button-pause-timer" onClick={() => timerAction.mutate({ action: "pause" })} className="rounded-lg border px-3 py-2 text-sm">Pause</button> : <button data-testid="button-resume-timer" onClick={() => timerAction.mutate({ action: "resume" })} className="rounded-lg border px-3 py-2 text-sm">Resume</button>}
              <button data-testid="button-stop-timer" onClick={() => timerAction.mutate({ action: "stop", rateCents: Math.round(Number(rate) * 100), billingCode })} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">Stop and save</button></div></>
              : <div className="mt-3 flex gap-2"><select data-testid="select-timer-task" value={taskPublicId} onChange={(e) => setTaskPublicId(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"><option value="">Select a task</option>{tasks.map((task) => <option key={task.publicId} value={task.publicId}>{task.title}</option>)}</select><button data-testid="button-start-timer" onClick={() => taskPublicId && timerAction.mutate({ action: "start", taskPublicId })} disabled={!taskPublicId} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">Start</button></div>}
          </section>
          <form onSubmit={handleAddTime} className="rounded-xl border border-border bg-card p-5">
            <h3 className="mb-4 font-semibold">Add time manually</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium">Task<select required value={taskPublicId} onChange={(e) => setTaskPublicId(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border bg-background px-2 text-sm"><option value="">Choose task</option>{tasks.map((task) => <option key={task.publicId} value={task.publicId}>{task.title}</option>)}</select></label>
              <label className="text-xs font-medium">Date<input required type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border bg-background px-2 text-sm" /></label>
              <label className="text-xs font-medium">Minutes<input required type="number" min="1" max="1440" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border bg-background px-2 text-sm" /></label>
              <label className="text-xs font-medium">Hourly rate ($)<input type="number" min="0" step=".01" value={rate} onChange={(e) => setRate(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border bg-background px-2 text-sm" /></label>
              <label className="text-xs font-medium">Billing code<input maxLength={40} value={billingCode} onChange={(e) => setBillingCode(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border bg-background px-2 text-sm" /></label>
              <label className="text-xs font-medium sm:col-span-2">Narrative<textarea maxLength={2000} value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border bg-background p-2 text-sm" /></label>
            </div>
            <button data-testid="button-save-time" disabled={addTime.isPending} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Save time entry</button>
          </form>
        </div>
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b p-4"><h3 className="font-semibold">Entries and approval</h3>{access.data?.user?.role === "ADMIN" && <button data-testid="button-export-billing" disabled={exportBilling.isPending} onClick={() => exportBilling.mutate()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><Download className="h-4 w-4" /> Export approved</button>}</div>
          {entries.isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading entries…</p> : <div className="divide-y">{(entries.data?.entries ?? []).map((entry) => <div key={entry.publicId} data-testid={`row-time-entry-${entry.publicId}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="text-sm font-medium">{entry.taskTitle}</p><p className="text-xs text-muted-foreground">{entry.workDate} · {entry.minutes} min · {entry.billingCode} · {entry.narrative || "No narrative"}</p></div>
            <div className="flex items-center gap-2"><span className="text-sm font-semibold">{money(entry.amountCents)}</span><span className="rounded-full bg-muted px-2 py-1 text-[10px]">{entry.approvalStatus}</span>{entry.canReview && entry.approvalStatus === "PENDING" && <><button aria-label="Approve time" onClick={() => review.mutate({ entryId: entry.publicId, status: "APPROVED" })} className="rounded-md border p-1.5 text-emerald-700"><Check className="h-4 w-4" /></button><button aria-label="Return time" onClick={() => review.mutate({ entryId: entry.publicId, status: "RETURNED" })} className="rounded-md border p-1.5 text-rose-700"><X className="h-4 w-4" /></button></>}</div>
          </div>)}</div>}
          {entries.data?.entries.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No time entries yet.</p>}
        </section>
      </div>
    </section>;
  }
  if (section === "management") return <section className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-9">
    <div className="mb-5 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Management</p><h2 className="mt-1 text-2xl font-semibold">Workload and billing overview</h2></div><BarChart3 className="h-6 w-6 text-primary" /></div>
    {report.isLoading ? <p>Loading reports…</p> : report.isError ? <p role="alert" className="text-sm text-rose-700">Management reporting is available to administrators only.</p> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ["Active assignments", report.data?.totals.active ?? 0], ["Overdue", report.data?.totals.overdue ?? 0], ["Billing to review", report.data?.totals.pendingBilling ?? 0],
        ["Approved", money(report.data?.totals.approvedCents ?? 0)], ["Exported", money(report.data?.totals.exportedCents ?? 0)],
      ].map(([label, value]) => <article key={String(label)} className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></article>)}</div>
      <div className="mt-5 overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs"><tr><th className="p-3">Practitioner</th><th className="p-3">Role</th><th className="p-3">Active tasks</th><th className="p-3">Time recorded</th></tr></thead><tbody>{report.data?.byUser.map((row) => <tr key={row.name} className="border-t"><td className="p-3 font-medium">{row.name}</td><td className="p-3">{row.role}</td><td className="p-3">{row.assigned}</td><td className="p-3">{(row.minutes / 60).toFixed(1)} h</td></tr>)}</tbody></table></div>
    </>}
  </section>;
  return <section className="mx-auto max-w-[1100px] px-4 pb-10 sm:px-6 lg:px-9"><div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Updates</p><h2 className="mt-1 text-2xl font-semibold">Notifications</h2></div>
    {notifications.isLoading ? <p>Loading notifications…</p> : <div className="divide-y rounded-xl border bg-card">{(notifications.data?.notifications ?? []).map((item) => <article key={item.publicId} data-testid={`notification-${item.publicId}`} className="flex items-start justify-between gap-4 p-4"><div className="flex gap-3"><Bell className="mt-1 h-4 w-4 text-primary" /><div><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.message}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></div></div>{!item.readAt && <button data-testid={`button-read-${item.publicId}`} onClick={() => markRead.mutate(item.publicId)} className="rounded-lg border px-3 py-1.5 text-xs">Mark read</button>}</article>)}</div>}
    {notifications.data?.notifications.length === 0 && <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">You’re all caught up.</p>}
  </section>;
}
