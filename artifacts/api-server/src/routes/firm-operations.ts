import { Router } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  db, portalUsersTable, attorneyClientsTable, clientsTable,
  internalWorkflowMattersTable as matters, internalWorkflowDocketTasksTable as docket,
  internalWorkflowTasksTable as internal, firmWorkflowRowsTable as rows,
  firmBillingItemsTable as bills, firmPaymentsTable as payments,
} from "@workspace/db";
import {
  UpdateFirmWorkflowRowBody as updateFirmWorkflowRowBody,
  ImportFirmWorkflowCsvBody as importFirmWorkflowCsvBody,
  CreateFirmBillingItemBody as createFirmBillingItemBody,
  UpdateFirmBillingItemBody as updateFirmBillingItemBody,
  RecordFirmPaymentBody as recordFirmPaymentBody,
} from "@workspace/api-zod";
import { requirePortalAccess } from "../middlewares/portalAccess";
import { calendarDate, readFirmCsv } from "../lib/firm-operations-csv";

const router = Router();
type User = typeof portalUsersTable.$inferSelect;
type Bill = typeof bills.$inferSelect;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const same = (a: string, b: string) => !!a.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const validDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && calendarDate(v) === v;

router.use("/portal/operations", requirePortalAccess, (req, res, next) => {
  if (!["ADMIN", "ATTORNEY", "PARALEGAL"].includes(req.portalUser!.role)) return void res.status(403).json({ error: "This workspace is for authorized firm staff only." });
  next();
});

async function sources(user: User) {
  const [dockets, internals, saved, staff] = await Promise.all([
    db.select({ task: docket, matter: matters }).from(docket).innerJoin(matters, eq(docket.matterId, matters.id)),
    db.select({ task: internal, matter: matters }).from(internal).leftJoin(matters, eq(internal.matterId, matters.id)),
    db.select().from(rows),
    db.select({ id: portalUsersTable.id, name: portalUsersTable.name, email: portalUsersTable.email, role: portalUsersTable.role })
      .from(portalUsersTable).where(and(eq(portalUsersTable.status, "ACTIVE"), eq(portalUsersTable.active, true), inArray(portalUsersTable.role, ["ADMIN", "ATTORNEY", "PARALEGAL"]))),
  ]);
  const names = new Set<string>();
  if (user.role === "ATTORNEY") {
    const clients = await db.select({ name: clientsTable.name }).from(attorneyClientsTable).innerJoin(clientsTable, eq(attorneyClientsTable.clientId, clientsTable.id)).where(eq(attorneyClientsTable.attorneyUserId, user.id));
    clients.forEach((c) => names.add(c.name.trim().toLowerCase()));
  }
  const savedByKey = new Map(saved.map((r) => [r.sourceKey, r]));
  const canMatter = (m: typeof matters.$inferSelect | null) => !!m && (
    user.role === "ATTORNEY" ? names.has(m.client.trim().toLowerCase()) :
      user.role === "PARALEGAL" && (same(m.paralegal, user.name) || same(m.paralegal, user.email)));
  const visibleDockets = dockets.filter(({ task, matter }) => user.role === "ADMIN" || canMatter(matter) ||
    savedByKey.get(`docket:${task.id}`)?.assignedToId === user.id || same(task.assignedPractitioner, user.email) || same(task.assignedPractitioner, user.name));
  const visibleInternals = internals.filter(({ task, matter }) => user.role === "ADMIN" || canMatter(matter) ||
    [task.createdById, task.assignedById, task.assignedToId, task.responsibleAttorneyId, savedByKey.get(`internal:${task.id}`)?.assignedToId].includes(user.id));
  return { dockets: visibleDockets, internals: visibleInternals, staff };
}

async function ensureWorkflow(user: User) {
  const source = await sources(user);
  const defaults = [
    ...source.dockets.map(({ task }) => ({
      sourceKey: `docket:${task.id}`, docketTaskId: task.id,
      assignedToId: source.staff.find((s) => same(task.assignedPractitioner, s.name) || same(task.assignedPractitioner, s.email))?.id ?? null,
      // A canceled task is not completed legal work and must never create a fee.
      filedOn: /cancel|withdraw|delete/i.test(task.status) ? null : task.completedDate,
    })),
    ...source.internals.map(({ task }) => ({
      sourceKey: `internal:${task.id}`, internalTaskId: task.id, assignedToId: task.assignedToId,
      filedOn: ["FINALIZED", "COMPLETED"].includes(task.workflowStatus) && task.finalizedAt ? task.finalizedAt.toISOString().slice(0, 10) : null,
    })),
  ];
  for (let i = 0; i < defaults.length; i += 200) {
    await db.insert(rows).values(defaults.slice(i, i + 200)).onConflictDoNothing({ target: rows.sourceKey });
  }
  const keys = defaults.map((r) => r.sourceKey);
  const trackers = keys.length ? await db.select().from(rows).where(inArray(rows.sourceKey, keys)) : [];
  const d = new Map(source.dockets.map((v) => [v.task.id, v]));
  const t = new Map(source.internals.map((v) => [v.task.id, v]));
  const result = trackers.map((r) => {
    const doc = r.docketTaskId ? d.get(r.docketTaskId) : undefined;
    const task = r.internalTaskId ? t.get(r.internalTaskId) : undefined;
    const matter = doc?.matter ?? task?.matter;
    return {
      ...r, title: doc?.task.title ?? task?.task.title ?? "",
      source: doc ? "AppColl" : "Internal",
      sourceOwner: doc?.task.assignedPractitioner ?? "",
      sourceStatus: doc?.task.status ?? task?.task.workflowStatus ?? "",
      client: matter?.client ?? "", matter: matter?.docketId || matter?.appCollMatterId || "",
      dueDate: doc?.task.officialDueDate ?? task?.task.officialDueDate ?? task?.task.internalTargetDate ?? null,
    };
  });
  // Existing completed rows are projected once, without approving or invoicing them.
  const completed = result.filter((v) => v.filedOn).map((r) => ({
    workflowRowId: r.id, ownerId: r.assignedToId ?? user.id, workDate: r.filedOn!,
    client: r.client, matter: r.matter, description: r.title,
  }));
  for (let i = 0; i < completed.length; i += 200) {
    await db.insert(bills).values(completed.slice(i, i + 200)).onConflictDoNothing({ target: bills.workflowRowId });
  }
  const linked = trackers.length ? await db.select({ workflowRowId: bills.workflowRowId, prebilledOn: bills.prebilledOn, voided: bills.voided }).from(bills).where(inArray(bills.workflowRowId, trackers.map((r) => r.id))) : [];
  const billingByRow = new Map(linked.map((b) => [b.workflowRowId, b]));
  return { result: result.map((r) => ({ ...r, prebilledOn: billingByRow.get(r.id)?.prebilledOn ?? null, prebillVoided: billingByRow.get(r.id)?.voided ?? false })), staff: source.staff.map(({ email: _email, ...s }) => s) };
}

router.get("/portal/operations", async (req, res, next) => {
  try {
    const workspace = await ensureWorkflow(req.portalUser!);
    res.json({ rows: workspace.result.map(({ id: _id, sourceKey: _key, docketTaskId: _d, internalTaskId: _i, updatedAt: _time, ...r }) => r), staff: workspace.staff, canImport: req.portalUser!.role === "ADMIN" });
  } catch (err) { next(err); }
});

router.patch("/portal/operations/rows/:id", async (req, res, next) => {
  try {
    const parsed = updateFirmWorkflowRowBody.safeParse(req.body);
    if (!uuid.test(String(req.params.id)) || !parsed.success) return void res.status(400).json({ error: "Invalid workflow update." });
    const data = parsed.data;
    if (!Number.isInteger(data.revision)) throw fail(400, "Invalid revision.");
    for (const key of ["strategySentOn", "clientApprovalSentOn", "paralegalSentOn", "filedOn", "prebillOn"] as const) {
      if (data[key] != null && !validDate(data[key])) throw fail(400, "Enter a valid calendar date.");
    }
    const user = req.portalUser!, workspace = await ensureWorkflow(user);
    const current = workspace.result.find((r) => r.publicId === req.params.id);
    if (!current) throw fail(404, "Task not found or access has changed.");
    if (data.assignedToId != null && (!Number.isInteger(data.assignedToId) || !workspace.staff.some((s) => s.id === data.assignedToId))) throw fail(400, "Choose an active staff member.");
    const result = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(rows).where(eq(rows.id, current.id)).for("update");
      if (!locked || locked.revision !== data.revision) throw fail(409, "This task changed. Refresh before saving; your entries have not been applied.");
      const [bill] = await tx.select().from(bills).where(eq(bills.workflowRowId, current.id)).for("update");
      if (data.prebillOn && (locked.filedOn || data.filedOn)) throw fail(409, "Only active work can be pre-billed. Completed work is already in billing.");
      if (data.prebillOn && bill?.prebilledOn && bill.prebilledOn !== data.prebillOn) throw fail(409, "This task was already pre-billed. Its original pre-billing date is preserved.");
      if (data.filedOn === null && locked.filedOn && bill && !bill.prebilledOn) {
        const receipts = await tx.select().from(payments).where(eq(payments.billingItemId, bill.id));
        if (bill.invoiceNumber || receipts.length) throw fail(409, "This work is already invoiced or paid. Resolve billing before reopening it.");
        await tx.update(bills).set({ voided: true, revision: bill.revision + 1 }).where(eq(bills.id, bill.id));
      }
      const { revision: _rev, prebillOn, ...changes } = data;
      const [updated] = await tx.update(rows).set({ ...changes, revision: locked.revision + 1, updatedAt: new Date() }).where(eq(rows.id, current.id)).returning();
      if (prebillOn) {
        if (bill) {
          if (!bill.prebilledOn && !bill.voided) throw fail(409, "This task already has a billing entry.");
          await tx.update(bills).set({
            prebilledOn: bill.prebilledOn ?? prebillOn, voided: false,
            ...(!bill.prebilledOn ? { workDate: prebillOn } : {}),
            revision: bill.revision + 1,
          }).where(eq(bills.id, bill.id));
        } else await tx.insert(bills).values({ workflowRowId: current.id, ownerId: updated!.assignedToId ?? user.id, client: current.client, matter: current.matter, description: current.title, workDate: prebillOn, prebilledOn: prebillOn }).onConflictDoNothing({ target: bills.workflowRowId });
      } else if (bill?.prebilledOn) {
        // Completion is independent from pre-billing/invoicing/payment. Preserve its financial dates and identity.
        if (data.filedOn !== undefined && data.filedOn !== locked.filedOn) await tx.update(bills).set({ revision: bill.revision + 1 }).where(eq(bills.id, bill.id));
      } else if (updated!.filedOn && (!bill || !locked.filedOn)) {
        if (bill) await tx.update(bills).set({ voided: false, workDate: updated!.filedOn, revision: bill.revision + 1 }).where(eq(bills.id, bill.id));
        else await tx.insert(bills).values({ workflowRowId: current.id, ownerId: updated!.assignedToId ?? user.id, client: current.client, matter: current.matter, description: current.title, workDate: updated!.filedOn }).onConflictDoNothing({ target: bills.workflowRowId });
      } else if (updated!.filedOn && bill && data.filedOn && data.filedOn !== locked.filedOn) {
        if (bill.invoiceNumber) throw fail(409, "The completion date is locked after invoicing.");
        await tx.update(bills).set({ workDate: updated!.filedOn, revision: bill.revision + 1 }).where(eq(bills.id, bill.id));
      }
      return updated!;
    });
    res.json({ publicId: result.publicId });
  } catch (err) { next(err); }
});

router.post("/portal/operations/import", async (req, res, next) => {
  try {
    if (req.portalUser!.role !== "ADMIN") throw fail(403, "Only administrators can import AppColl CSV files.");
    const parsed = importFirmWorkflowCsvBody.safeParse(req.body);
    if (!parsed.success) throw fail(400, "Choose a task CSV smaller than 8 MB.");
    const input = parsed.data;
    const { rows: tasks, errors } = readFirmCsv(input.csvText);
    if (tasks.length > 10000) throw fail(400, "Import at most 10,000 tasks per CSV.");
    const knownMatters = await db.select().from(matters);
    const knownTasks = await db.select({ externalId: docket.externalTaskId }).from(docket);
    const known = new Set(knownTasks.map((t) => t.externalId));
    tasks.forEach((t, i) => {
      const matches = knownMatters.filter((m) => m.appCollMatterId === t.matter || m.docketId === t.matter);
      if (matches.length > 1) errors.push(`Row ${i + 2}: matter reference ${t.matter} is ambiguous.`);
    });
    const added = tasks.filter((t) => !known.has(t.externalId)).length;
    const summary = { added, updated: tasks.length - added, rows: tasks.slice(0, 100).map(({ externalId, matter, title, client }) => ({ externalId, matter, title, client })), errors, applied: false };
    if (input.preview || errors.length) return void res.json(summary);
    await db.transaction(async (tx) => {
      // Serializes imports so simultaneous batches cannot link one source ID differently.
      await tx.execute(sql`select pg_advisory_xact_lock(7318042)`);
      for (const t of tasks) {
        let [matter] = await tx.select().from(matters).where(sql`${matters.appCollMatterId} = ${t.matter} OR ${matters.docketId} = ${t.matter}`);
        if (!matter) {
          const id = `task-ref:${createHash("sha256").update(t.matter).digest("hex").slice(0, 40)}`;
          [matter] = await tx.insert(matters).values({ appCollMatterId: id, docketId: t.matter, client: t.client, rawRecord: { AttorneyRef: t.matter, Client: t.client } }).onConflictDoUpdate({ target: matters.appCollMatterId, set: { docketId: t.matter } }).returning();
        }
        const values = { matterId: matter!.id, title: t.title, description: t.description, officialDueDate: t.due, assignedPractitioner: t.owner, status: t.status, completedDate: t.closed, rawRecord: t.raw, lastImportedAt: new Date() };
        await tx.insert(docket).values({ externalTaskId: t.externalId, ...values }).onConflictDoUpdate({ target: docket.externalTaskId, set: values });
      }
    });
    await ensureWorkflow(req.portalUser!);
    res.json({ ...summary, applied: true });
  } catch (err) { next(err); }
});

function canBill(user: User, bill: Bill) { return user.role === "ADMIN" || bill.ownerId === user.id; }
function checkFinancialInput(data: { workDate: string; amountCents: number; shareBasisPoints: number }) {
  if (!validDate(data.workDate) || !Number.isInteger(data.amountCents) || !Number.isInteger(data.shareBasisPoints)) throw fail(400, "Use a valid work date, whole cents, and a valid percentage.");
}
async function billingItem(id: string, user: User) {
  if (!uuid.test(id)) throw fail(404, "Billing item not found.");
  const [bill] = await db.select().from(bills).where(eq(bills.publicId, id));
  if (!bill || !canBill(user, bill)) throw fail(404, "Billing item not found or access has changed.");
  return bill;
}
router.get("/portal/operations/billing", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    await ensureWorkflow(user);
    const entries = await db.select({ bill: bills, ownerName: portalUsersTable.name, workflowPublicId: rows.publicId, completedOn: rows.filedOn })
      .from(bills).innerJoin(portalUsersTable, eq(bills.ownerId, portalUsersTable.id)).leftJoin(rows, eq(bills.workflowRowId, rows.id))
      .where(user.role === "ADMIN" ? undefined : eq(bills.ownerId, user.id));
    const ids = entries.map(({ bill }) => bill.id);
    const receipts = ids.length ? await db.select().from(payments).where(inArray(payments.billingItemId, ids)) : [];
    res.json({ items: entries.map(({ bill, ownerName, workflowPublicId, completedOn }) => {
      const paid = receipts.filter((r) => r.billingItemId === bill.id);
      const { id: _id, ownerId: _owner, workflowRowId: _workflow, createdAt: _created, ...data } = bill;
      return { ...data, ownerName, workflowPublicId, completedOn, paidCents: paid.reduce((total, p) => total + p.amountCents, 0),
        payments: paid.map(({ publicId, amountCents, receivedOn, reference }) => ({ publicId, amountCents, receivedOn, reference })) };
    }) });
  } catch (err) { next(err); }
});
router.post("/portal/operations/billing", async (req, res, next) => {
  try {
    const parsed = createFirmBillingItemBody.safeParse(req.body);
    if (!parsed.success) throw fail(400, "Enter all required billing fields and a non-negative flat amount.");
    checkFinancialInput(parsed.data);
    const [result] = await db.insert(bills).values({ ...parsed.data, ownerId: req.portalUser!.id }).returning();
    res.status(201).json({ publicId: result!.publicId });
  } catch (err) { next(err); }
});
router.patch("/portal/operations/billing/:id", async (req, res, next) => {
  try {
    const parsed = updateFirmBillingItemBody.safeParse(req.body);
    if (!parsed.success || !Number.isInteger(parsed.data.revision)) throw fail(400, "Enter valid billing fields.");
    const data = parsed.data;
    checkFinancialInput(data);
    if (!!data.invoiceNumber.trim() !== !!data.invoiceDate || (data.invoiceDate && !validDate(data.invoiceDate))) throw fail(400, "Enter both an invoice number and a valid invoice date, or leave both blank.");
    if (data.kind === "REIMBURSEMENT" && data.invoiceNumber) throw fail(400, "Reimbursements to the firm are recovery receipts, not client invoices.");
    const bill = await billingItem(String(req.params.id), req.portalUser!);
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(bills).where(eq(bills.id, bill.id)).for("update");
      if (!current || current.revision !== data.revision) throw fail(409, "This billing item changed. Refresh before saving.");
      const receipts = await tx.select().from(payments).where(eq(payments.billingItemId, bill.id));
      if ((current.invoiceNumber || receipts.length) && ["kind", "workDate", "amountCents", "shareBasisPoints", "invoiceNumber", "invoiceDate", "client", "matter"].some((key) => data[key as keyof typeof data] !== current[key as keyof typeof current])) throw fail(409, "Invoiced or paid financial values are locked. Notes and descriptions may still be updated.");
      if (data.voided && (current.invoiceNumber || receipts.length)) throw fail(409, "An invoiced or paid item cannot be voided here.");
      const { revision: _rev, ...changes } = data;
      await tx.update(bills).set({ ...changes, invoiceNumber: data.invoiceNumber.trim(), revision: current.revision + 1 }).where(eq(bills.id, bill.id));
    });
    res.json({ publicId: bill.publicId });
  } catch (err) { next(err); }
});
router.post("/portal/operations/billing/:id/payments", async (req, res, next) => {
  try {
    const parsed = recordFirmPaymentBody.safeParse(req.body);
    if (!parsed.success || !Number.isInteger(parsed.data.amountCents) || !validDate(parsed.data.receivedOn)) throw fail(400, "Enter a valid receipt date and a positive payment amount.");
    const bill = await billingItem(String(req.params.id), req.portalUser!);
    const data = parsed.data;
    const result = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(bills).where(eq(bills.id, bill.id)).for("update");
      const [existing] = await tx.select().from(payments).where(eq(payments.requestId, data.requestId));
      if (existing) {
        if (existing.billingItemId !== bill.id || existing.amountCents !== data.amountCents || existing.receivedOn !== data.receivedOn || existing.reference !== data.reference) throw fail(409, "That payment request was already used for a different receipt.");
        return existing;
      }
      if (!locked || locked.voided) throw fail(409, "A voided item cannot receive a payment.");
      if (!locked.invoiceNumber && locked.kind !== "REIMBURSEMENT") throw fail(409, "Record the invoice number and date before recording payment.");
      const prior = await tx.select().from(payments).where(eq(payments.billingItemId, bill.id));
      if (prior.reduce((total, p) => total + p.amountCents, 0) + data.amountCents > locked.amountCents) throw fail(409, "Payment exceeds this item's remaining balance.");
      const [receipt] = await tx.insert(payments).values({ ...data, billingItemId: bill.id, createdById: req.portalUser!.id }).returning();
      await tx.update(bills).set({ revision: locked.revision + 1 }).where(eq(bills.id, bill.id));
      return receipt!;
    });
    res.status(201).json({ publicId: result.publicId });
  } catch (err) { next(err); }
});

router.use("/portal/operations", (err: unknown, _req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (err instanceof Error && "status" in err && typeof err.status === "number") return void res.status(err.status).json({ error: err.message });
  _req.log?.error({ err }, "Firm operations request failed");
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "The change could not be confirmed. Your entries have been kept; refresh and retry." });
});
export default router;
