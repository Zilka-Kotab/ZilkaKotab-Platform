import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  db, portalUsersTable,
  internalWorkflowMattersTable as matters, internalWorkflowDocketTasksTable as docket,
  internalWorkflowTasksTable as internal, firmWorkflowRowsTable as rows,
  firmBillingItemsTable as bills, firmPaymentsTable as payments,
  firmWorkflowStatusHistoryTable as history, internalWorkflowContributorsTable as contributors,
  firmFeeSchedulesTable as schedules,
} from "@workspace/db";
import {
  UpdateFirmWorkflowRowBody as updateFirmWorkflowRowBody,
  ImportFirmWorkflowCsvBody as importFirmWorkflowCsvBody,
  CreateFirmBillingItemBody as createFirmBillingItemBody,
  UpdateFirmBillingItemBody as updateFirmBillingItemBody,
  RecordFirmPaymentBody as recordFirmPaymentBody,
  CreateFirmFeeScheduleBody as createFirmFeeScheduleBody,
} from "@workspace/api-zod";
import { requirePortalAccess } from "../middlewares/portalAccess";
import { calendarDate, readFirmCsv } from "../lib/firm-operations-csv";
import { appCollParticipants, assignedStaffIds } from "../lib/firm-workflow-identity";
import { feeAllocations, workflowBillValues } from "../lib/firm-fee-allocation";

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
  const [dockets, internals, saved, staff, participation] = await Promise.all([
    db.select({ task: docket, matter: matters }).from(docket).innerJoin(matters, eq(docket.matterId, matters.id)),
    db.select({ task: internal, matter: matters }).from(internal).leftJoin(matters, eq(internal.matterId, matters.id)),
    db.select().from(rows),
    db.select({ id: portalUsersTable.id, name: portalUsersTable.name, email: portalUsersTable.email, role: portalUsersTable.role })
      .from(portalUsersTable).where(and(eq(portalUsersTable.status, "ACTIVE"), eq(portalUsersTable.active, true), inArray(portalUsersTable.role, ["ADMIN", "ATTORNEY", "PARALEGAL"]))),
    db.select().from(contributors).where(eq(contributors.userId, user.id)),
  ]);
  const savedByKey = new Map(saved.map((r) => [r.sourceKey, r]));
  const visibleDockets = dockets.filter(({ task }) => user.role === "ADMIN" ||
    savedByKey.get(`docket:${task.id}`)?.assignedToId === user.id || appCollParticipants(task.assignedPractitioner, task.rawRecord, staff).includes(user.id));
  const visibleInternals = internals.filter(({ task }) => user.role === "ADMIN" ||
    [task.assignedToId, task.responsibleAttorneyId, savedByKey.get(`internal:${task.id}`)?.assignedToId].includes(user.id) ||
    participation.some((c) => c.taskId === task.id));
  return { dockets: visibleDockets, internals: visibleInternals, staff };
}

async function ensureWorkflow(user: User) {
  const source = await sources(user);
  const defaults = [
    ...source.dockets.map(({ task }) => ({
      sourceKey: `docket:${task.id}`, docketTaskId: task.id,
      assignedToId: assignedStaffIds(task.assignedPractitioner, source.staff).length === 1 ? assignedStaffIds(task.assignedPractitioner, source.staff)[0]! : null,
      status: !/cancel|withdraw|delete/i.test(task.status) && task.completedDate ? "Filed" : assignedStaffIds(task.assignedPractitioner, source.staff).length ? "Assigned" : "Unassigned",
      statusDate: !/cancel|withdraw|delete/i.test(task.status) ? task.completedDate : null,
      // A canceled task is not completed legal work and must never create a fee.
      filedOn: /cancel|withdraw|delete/i.test(task.status) ? null : task.completedDate,
    })),
    ...source.internals.map(({ task }) => ({
      sourceKey: `internal:${task.id}`, internalTaskId: task.id, assignedToId: task.assignedToId,
      filedOn: ["FINALIZED", "COMPLETED"].includes(task.workflowStatus) && task.finalizedAt ? task.finalizedAt.toISOString().slice(0, 10) : null,
      status: ["FINALIZED", "COMPLETED"].includes(task.workflowStatus) && task.finalizedAt ? "Filed" : task.assignedToId ? "Assigned" : "Unassigned",
      statusDate: ["FINALIZED", "COMPLETED"].includes(task.workflowStatus) && task.finalizedAt ? task.finalizedAt.toISOString().slice(0, 10) : null,
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
      sourceOwnerId: doc ? (assignedStaffIds(doc.task.assignedPractitioner, source.staff).length === 1 ? assignedStaffIds(doc.task.assignedPractitioner, source.staff)[0]! : null) : task?.task.responsibleAttorneyId ?? null,
      sourceStatus: doc?.task.status ?? task?.task.workflowStatus ?? "",
      client: matter?.client ?? "", matter: matter?.docketId || matter?.appCollMatterId || "",
      dueDate: doc?.task.officialDueDate ?? task?.task.officialDueDate ?? task?.task.internalTargetDate ?? null,
    };
  });
  // Existing completed rows are projected once, without approving or invoicing them.
  const historicalPeople = result.some((r) => r.filedOn && r.billingDraft) ?
    await db.select({ id: portalUsersTable.id, name: portalUsersTable.name }).from(portalUsersTable) : source.staff;
  const completed = result.filter((v) => v.filedOn).map((r) => ({
    workflowRowId: r.id, ownerId: r.assignedToId ?? user.id, workDate: r.filedOn!,
    client: r.client, matter: r.matter, description: r.title,
    ...(r.billingDraft ? workflowBillValues(r.billingDraft, feeAllocations(r.billingDraft, historicalPeople)) : {}),
  }));
  for (let i = 0; i < completed.length; i += 200) {
    await db.insert(bills).values(completed.slice(i, i + 200)).onConflictDoNothing({ target: bills.workflowRowId });
  }
  const linked = trackers.length ? await db.select().from(bills).where(inArray(bills.workflowRowId, trackers.map((r) => r.id))) : [];
  const billingByRow = new Map(linked.map((b) => [b.workflowRowId, b]));
  const counts = trackers.length ? await db.select({ rowId: history.workflowRowId, count: sql<number>`count(*)::int` }).from(history).where(inArray(history.workflowRowId, trackers.map((r) => r.id))).groupBy(history.workflowRowId) : [];
  const countByRow = new Map(counts.map((c) => [c.rowId, c.count]));
  const billIds = linked.map((b) => b.id);
  const paidBills = billIds.length ? await db.select({ id: payments.billingItemId }).from(payments).where(inArray(payments.billingItemId, billIds)) : [];
  return { result: result.map((r) => {
    const bill = billingByRow.get(r.id);
    return { ...r, billingDraft: r.billingDraft ?? (bill ? {
      scheduleId: null, entryId: null, code: bill.code, jurisdiction: bill.jurisdiction,
      subjectMatter: bill.subjectMatter, itemShort: bill.description, description: "", details: "",
      notes: bill.notes, amountCents: bill.amountCents, ownerId: bill.ownerId,
      ownerShareBasisPoints: bill.shareBasisPoints, ownerFixedCents: null,
      assigneeId: null, assigneeShareBasisPoints: 0,
    } : null), billingLocked: !!bill?.invoiceNumber || paidBills.some((p) => p.id === bill?.id),
      historyCount: countByRow.get(r.id) ?? 0, prebilledOn: bill?.prebilledOn ?? null, prebillVoided: bill?.voided ?? false };
  }), staff: source.staff.map(({ email: _email, ...s }) => s) };
}

const clientKey = (v: string) => v.trim().toLowerCase();
router.get("/portal/operations/fee-schedules", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const source = await sources(user);
    const clients = new Set([...source.dockets, ...source.internals].map((s) => clientKey(s.matter?.client ?? "")));
    const all = await db.select().from(schedules).orderBy(desc(schedules.id));
    res.json({ schedules: all.filter((s) => user.role === "ADMIN" || clients.has(clientKey(s.client))).map(({ id: _id, createdById: _by, ...s }) => ({ ...s, createdAt: s.createdAt.toISOString() })) });
  } catch (err) { next(err); }
});
router.post("/portal/operations/fee-schedules", async (req, res, next) => {
  try {
    if (req.portalUser!.role !== "ADMIN") throw fail(403, "Only administrators can upload client fee schedules.");
    const parsed = createFirmFeeScheduleBody.safeParse(req.body);
    if (!parsed.success) throw fail(400, "Review the schedule: each entry needs a code, item, jurisdiction, rate type and valid amount.");
    const data = parsed.data;
    if (!data.client.trim() || !data.name.trim()) throw fail(400, "Enter a client and schedule name.");
    if (new Set(data.entries.map((e) => e.id)).size !== data.entries.length) throw fail(400, "Each schedule entry needs a distinct ID, including duplicate billing codes.");
    for (const entry of data.entries) {
      if (!entry.code.trim() || !entry.itemShort.trim()) throw fail(400, "Codes and item names cannot be blank.");
      if ((entry.rateType === "FLAT") !== (entry.amountCents !== null)) throw fail(400, "Only fixed flat fees have a default amount. Hourly, approval and adjustment entries require a manually entered flat amount when used.");
    }
    const [saved] = await db.insert(schedules).values({ ...data, client: data.client.trim(), name: data.name.trim(), createdById: req.portalUser!.id }).returning();
    res.status(201).json({ publicId: saved!.publicId });
  } catch (err) { next(err); }
});

router.get("/portal/operations/rows/:id/history", async (req, res, next) => {
  try {
    const workspace = await ensureWorkflow(req.portalUser!);
    const row = workspace.result.find((r) => r.publicId === req.params.id);
    if (!row) throw fail(404, "Task not found or access has changed.");
    const events = await db.select({ publicId: history.publicId, status: history.status, statusDate: history.statusDate, note: history.note, actorName: portalUsersTable.name, recordedAt: history.recordedAt })
      .from(history).leftJoin(portalUsersTable, eq(history.actorId, portalUsersTable.id)).where(eq(history.workflowRowId, row.id)).orderBy(desc(history.id));
    res.json({ events: events.map((e) => ({ ...e, actorName: e.actorName ?? "Preserved milestone history", recordedAt: e.recordedAt.toISOString() })) });
  } catch (err) { next(err); }
});

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
    if ((data.statusDate !== undefined || data.statusNote !== undefined) && !data.status) throw fail(400, "Choose the status for this dated update.");
    if (data.status && !data.statusDate) throw fail(400, "Enter the date this status was reached.");
    if (data.status && data.filedOn !== undefined) throw fail(400, "Use the status reached date, not a separate completion field.");
    for (const key of ["strategySentOn", "clientApprovalSentOn", "paralegalSentOn", "filedOn", "prebillOn", "statusDate"] as const) {
      if (data[key] != null && !validDate(data[key])) throw fail(400, "Enter a valid calendar date.");
    }
    const user = req.portalUser!, workspace = await ensureWorkflow(user);
    const current = workspace.result.find((r) => r.publicId === req.params.id);
    if (!current) throw fail(404, "Task not found or access has changed.");
    if (data.priorityDeadline != null && (!validDate(data.priorityDeadline) || !current.dueDate || data.priorityDeadline >= current.dueDate)) throw fail(400, "A priority deadline must be a valid date earlier than the actual due date.");
    let allocation: ReturnType<typeof feeAllocations> | undefined;
    if (data.billingDraft) {
      try { allocation = feeAllocations(data.billingDraft, workspace.staff); }
      catch (err) { throw fail(400, (err as Error).message); }
      const draft = data.billingDraft;
      if (!!draft.scheduleId !== !!draft.entryId) throw fail(400, "Choose a schedule entry or use manual billing.");
      if (draft.scheduleId) {
        if (!uuid.test(draft.scheduleId)) throw fail(400, "Choose a valid fee schedule.");
        const [schedule] = await db.select().from(schedules).where(eq(schedules.publicId, draft.scheduleId));
        const entry = schedule?.entries.find((e) => e.id === draft.entryId);
        if (!schedule || clientKey(schedule.client) !== clientKey(current.client) || !entry) throw fail(400, "That schedule entry does not belong to this task's client.");
        if (draft.code !== entry.code || draft.jurisdiction !== entry.jurisdiction) throw fail(400, "Fee code and jurisdiction must match the selected schedule entry.");
        if (entry.rateType === "ADJUSTMENT") throw fail(400, "A courtesy markdown is not an additional positive fee. Apply the approved discount to the substantive item's gross fee instead.");
      }
    }
    if (data.assignedToId != null && (!Number.isInteger(data.assignedToId) || !workspace.staff.some((s) => s.id === data.assignedToId))) throw fail(400, "Choose an active staff member.");
    const result = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(rows).where(eq(rows.id, current.id)).for("update");
      if (!locked || locked.revision !== data.revision) throw fail(409, "This task changed. Refresh before saving; your entries have not been applied.");
      const [bill] = await tx.select().from(bills).where(eq(bills.workflowRowId, current.id)).for("update");
      let stage = data.status;
      let reached = data.statusDate;
      // Compatibility for older callers; new UI uses only a single status/date/note update.
      if (!stage && data.filedOn !== undefined) {
        stage = data.filedOn ? "Filed" : (data.assignedToId ?? locked.assignedToId) ? "Assigned" : "Unassigned";
        reached = data.filedOn ?? new Date().toISOString().slice(0, 10);
      }
      const filedOn = stage ? (stage === "Filed" ? reached! : null) : data.filedOn;
      const receipts = bill ? await tx.select().from(payments).where(eq(payments.billingItemId, bill.id)) : [];
      const financiallyLocked = !!bill?.invoiceNumber || receipts.length > 0;
      if (data.billingDraft && financiallyLocked && bill) {
        const desired = workflowBillValues(data.billingDraft, allocation!);
        const financialAllocations = (items: typeof desired.allocations) => items.map(({ userId, role, amountCents }) => ({ userId, role, amountCents }));
        const sameAllocations = bill.allocations.length ?
          JSON.stringify(financialAllocations(desired.allocations)) === JSON.stringify(financialAllocations(bill.allocations)) :
          desired.allocations.filter((a) => a.role === "OWNER").every((a) => a.userId === bill.ownerId && a.amountCents === Math.round(bill.amountCents * bill.shareBasisPoints / 10000)) &&
          desired.allocations.filter((a) => a.role === "ASSIGNEE").every((a) => a.amountCents === 0);
        if (desired.amountCents !== bill.amountCents || desired.ownerId !== bill.ownerId ||
          desired.kind !== bill.kind || desired.shareBasisPoints !== bill.shareBasisPoints ||
          !sameAllocations) throw fail(409, "Invoiced or paid gross fees and allocations are locked. Existing invoices and receipts are preserved.");
      }
      // Billing drafts and actual charges are distinct: editing active work never creates a charge.
      const draft = data.billingDraft ?? locked.billingDraft;
      // Historical recipients may be inactive; a status-only update must not rewrite their split.
      const historicalAllocations = bill?.allocations.length ? bill.allocations : undefined;
      const billValues = draft ? workflowBillValues(draft, allocation ?? historicalAllocations ?? feeAllocations(draft,
        await tx.select({ id: portalUsersTable.id, name: portalUsersTable.name }).from(portalUsersTable))) : {};
      if (data.billingDraft && bill) await tx.update(bills).set({ ...billValues, revision: bill.revision + 1 }).where(eq(bills.id, bill.id));
      if (data.prebillOn && (locked.filedOn || filedOn)) throw fail(409, "Only active work can be pre-billed. Completed work is already in billing.");
      if (data.prebillOn && bill?.prebilledOn && bill.prebilledOn !== data.prebillOn) throw fail(409, "This task was already pre-billed. Its original pre-billing date is preserved.");
      if (filedOn === null && locked.filedOn && bill && !bill.prebilledOn && !financiallyLocked) {
        await tx.update(bills).set({ voided: true, revision: bill.revision + 1 }).where(eq(bills.id, bill.id));
      }
      const { revision: _rev, prebillOn, status: _status, statusDate: _date, statusNote: _note, ...changes } = data;
      const [updated] = await tx.update(rows).set({
        ...changes, ...(stage ? { status: stage, statusDate: reached!, statusNote: data.statusNote ?? "", filedOn } : {}),
        ...(!stage && data.assignedToId !== undefined && ["Unassigned", "Assigned"].includes(locked.status) ?
          { status: data.assignedToId ? "Assigned" : "Unassigned", statusDate: null, statusNote: "" } : {}),
        revision: locked.revision + 1, updatedAt: new Date(),
      }).where(eq(rows.id, current.id)).returning();
      if (stage) await tx.insert(history).values({ workflowRowId: locked.id, status: stage, statusDate: reached!, note: data.statusNote ?? "", actorId: user.id });
      if (prebillOn) {
        if (bill) {
          if (!bill.prebilledOn && !bill.voided) throw fail(409, "This task already has a billing entry.");
          await tx.update(bills).set({
            prebilledOn: bill.prebilledOn ?? prebillOn, voided: false,
            ...(!bill.prebilledOn ? { workDate: prebillOn } : {}),
            revision: bill.revision + 1,
          }).where(eq(bills.id, bill.id));
        } else await tx.insert(bills).values({ workflowRowId: current.id, ownerId: updated!.assignedToId ?? user.id, client: current.client, matter: current.matter, description: current.title, workDate: prebillOn, prebilledOn: prebillOn, ...billValues }).onConflictDoNothing({ target: bills.workflowRowId });
      } else if (bill && (bill.prebilledOn || financiallyLocked)) {
        // Repeated stages and reopening never delete invoices/receipts or change the original charge date.
        if (filedOn !== undefined && filedOn !== locked.filedOn) await tx.update(bills).set({ revision: bill.revision + 1 }).where(eq(bills.id, bill.id));
      } else if (updated!.filedOn && (!bill || !locked.filedOn)) {
        if (bill) await tx.update(bills).set({ voided: false, workDate: updated!.filedOn, revision: bill.revision + 1 }).where(eq(bills.id, bill.id));
        else await tx.insert(bills).values({ workflowRowId: current.id, ownerId: updated!.assignedToId ?? user.id, client: current.client, matter: current.matter, description: current.title, workDate: updated!.filedOn, ...billValues }).onConflictDoNothing({ target: bills.workflowRowId });
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

function canBill(user: User, bill: Bill) { return user.role === "ADMIN" || bill.ownerId === user.id || bill.allocations.some((a) => a.userId === user.id); }
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
      .where(user.role === "ADMIN" ? undefined : sql`(${bills.ownerId} = ${user.id} OR EXISTS (SELECT 1 FROM jsonb_array_elements(${bills.allocations}) a WHERE (a->>'userId')::integer = ${user.id}))`);
    const ids = entries.map(({ bill }) => bill.id);
    const receipts = ids.length ? await db.select().from(payments).where(inArray(payments.billingItemId, ids)) : [];
    res.json({ items: entries.map(({ bill, ownerName, workflowPublicId, completedOn }) => {
      const paid = receipts.filter((r) => r.billingItemId === bill.id);
      const { id: _id, ownerId: _owner, workflowRowId: _workflow, createdAt: _created, ...data } = bill;
      return { ...data, allocatedNetCents: bill.allocations.length ? bill.allocations.filter((a) => user.role === "ADMIN" || a.userId === user.id).reduce((sum, a) => sum + a.amountCents, 0) : null,
        ownerName, workflowPublicId, completedOn, paidCents: paid.reduce((total, p) => total + p.amountCents, 0),
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
      if (current.allocations.length && ["kind", "amountCents", "shareBasisPoints", "client", "matter", "description", "code", "jurisdiction", "subjectMatter", "associate", "notes"].some((key) => data[key as keyof typeof data] !== current[key as keyof typeof current])) throw fail(409, "Edit allocated fees and item details in the workflow Billing pane. This keeps the draft, charge, and owner/assignee shares consistent.");
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
