import { createHash } from "node:crypto";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { Router } from "express";
import {
  db,
  attorneyClientsTable,
  clientsTable,
  internalWorkflowImportsTable,
  internalWorkflowMattersTable,
  internalWorkflowTasksTable,
  internalWorkflowTaskAuditTable,
  internalWorkflowCommentsTable,
  internalWorkflowTimeEntriesTable,
  internalWorkflowTimerSessionsTable,
  internalWorkflowNotificationsTable,
  internalWorkflowContributorsTable,
  portalUsersTable,
  type AppCollMatterRecord,
} from "@workspace/db";
import { requireAdmin, requirePortalAccess } from "../middlewares/portalAccess";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CSV_CHARS = 8_000_000;

type ImportException = { row: number; field: string; message: string };
type MatterPreview = {
  publicId: string;
  fileName: string;
  summary: Record<string, number>;
  exceptions: ImportException[];
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function toDate(value: string) {
  const input = value.trim();
  if (!input) return null;
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input) ?? /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (!match) return null;
  const year = Number(match[1]!.length === 4 ? match[1] : match[3]);
  const month = Number(match[1]!.length === 4 ? match[2] : match[1]);
  const day = Number(match[1]!.length === 4 ? match[3] : match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : null;
}

function countValue(value: string) {
  const number = Number(value.trim());
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function matterValues(record: AppCollMatterRecord) {
  return {
    appCollMatterId: record.MatterID?.trim() ?? "",
    docketId: record.AttorneyRef?.trim() ?? "",
    title: record.Title?.trim() ?? "",
    matterType: record.Type?.trim() ?? "",
    status: record.Status?.trim() ?? "",
    responsibleAttorney: record.Attorney?.trim() ?? "",
    paralegal: record.Paralegal?.trim() ?? "",
    client: record.Client?.trim() ?? "",
    clientReference: record.ClientRef?.trim() ?? "",
    applicationNumber: record.ApplicationNum?.trim() ?? "",
    patentNumber: record.PatentNum?.trim() ?? "",
    ptoStatus: record.PTOStatus?.trim() ?? "",
    nextExternalTask: record.NextExternalTask?.trim() ?? "",
    nextExternalDueDate: toDate(record.NextExternalTaskDueDate ?? ""),
    nextInternalTask: record.NextInternalTask?.trim() ?? "",
    nextInternalDueDate: toDate(record.NextInternalTaskDueDate ?? ""),
    openExternalTaskCount: countValue(record.OpenTaskCountExternal ?? ""),
    openInternalTaskCount: countValue(record.OpenTaskCountInternal ?? ""),
    rawRecord: record,
    lastImportedAt: new Date(),
  };
}

function serializeMatter(matter: typeof internalWorkflowMattersTable.$inferSelect) {
  return {
    publicId: matter.publicId,
    appCollMatterId: matter.appCollMatterId,
    docketId: matter.docketId,
    title: matter.title,
    matterType: matter.matterType,
    status: matter.status,
    responsibleAttorney: matter.responsibleAttorney,
    paralegal: matter.paralegal,
    client: matter.client,
    clientReference: matter.clientReference,
    applicationNumber: matter.applicationNumber,
    patentNumber: matter.patentNumber,
    ptoStatus: matter.ptoStatus,
    nextExternalTask: matter.nextExternalTask,
    nextExternalDueDate: matter.nextExternalDueDate,
    nextInternalTask: matter.nextInternalTask,
    nextInternalDueDate: matter.nextInternalDueDate,
    openExternalTaskCount: matter.openExternalTaskCount,
    openInternalTaskCount: matter.openInternalTaskCount,
    lastImportedAt: matter.lastImportedAt,
  };
}

const workflowStatuses = ["PENDING_WITH_ME", "ASSIGNED_WITH_ANOTHER", "READY_FOR_PROOF", "CLIENT_REVIEW", "READY_FOR_FILING", "FINALIZED"] as const;
const strategyStatuses = ["STRATEGY_NEEDED", "STRATEGY_IN_REVIEW", "STRATEGY_APPROVED", "NOT_APPLICABLE"] as const;
const statusLabelsForNotification = (status: string) => status.replaceAll("_", " ").toLowerCase();
async function canReadTask(userId: number, role: string, task: typeof internalWorkflowTasksTable.$inferSelect) {
  return role === "ADMIN" || task.createdById === userId || task.assignedById === userId || task.assignedToId === userId || task.responsibleAttorneyId === userId;
}
async function notifyUser(tx: any, userId: number, taskId: number, title: string, message: string) {
  await tx.insert(internalWorkflowNotificationsTable).values({ userId, taskId, title, message });
}

router.use(requirePortalAccess, (req, res, next) => {
  if (req.portalUser?.role !== "ATTORNEY" && req.portalUser?.role !== "PARALEGAL" && req.portalUser?.role !== "ADMIN") {
    res.status(403).json({ error: "Internal workflow access is restricted to firm staff." });
    return;
  }
  next();
});

router.get("/portal/internal-workflow/matters", async (_req, res, next) => {
  try {
    const user = _req.portalUser!;
    let matters = await db.select().from(internalWorkflowMattersTable).orderBy(asc(internalWorkflowMattersTable.docketId));
    if (user.role === "ATTORNEY") {
      const clientIds = await db.select({ id: attorneyClientsTable.clientId }).from(attorneyClientsTable).where(eq(attorneyClientsTable.attorneyUserId, user.id));
      const clients = clientIds.length
        ? await db.select({ name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds.map(({ id }) => id)))
        : [];
      const names = new Set(clients.map(({ name }) => name.trim().toLowerCase()));
      matters = matters.filter((matter) => names.has(matter.client.trim().toLowerCase()));
    } else if (user.role === "PARALEGAL") {
      matters = matters.filter((matter) => matter.paralegal.trim().toLowerCase() === user.name.trim().toLowerCase());
    }
    res.json({ matters: matters.map(serializeMatter) });
  } catch (error) {
    next(error);
  }
});

router.get("/portal/internal-workflow/imports", async (_req, res, next) => {
  try {
    if (_req.portalUser?.role !== "ADMIN") return void res.json({ imports: [] });
    const imports = await db.select().from(internalWorkflowImportsTable).orderBy(asc(internalWorkflowImportsTable.createdAt));
    res.json({ imports: imports.reverse().map((item) => ({
      publicId: item.publicId,
      fileName: item.fileName,
      status: item.status,
      summary: item.summary,
      exceptions: item.exceptions,
      createdAt: item.createdAt,
      appliedAt: item.appliedAt,
    })) });
  } catch (error) {
    next(error);
  }
});

router.post("/portal/internal-workflow/imports/preview", requireAdmin, async (req, res, next) => {
  try {
    const csvText = typeof req.body?.csvText === "string" ? req.body.csvText : "";
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim().slice(0, 240) : "";
    if (!fileName || !csvText) return void res.status(400).json({ error: "Choose a CSV file to preview." });
    if (csvText.length > MAX_CSV_CHARS) return void res.status(413).json({ error: "The CSV exceeds the 8 MB import limit." });
    const fileHash = createHash("sha256").update(csvText, "utf8").digest("hex");
    const [duplicate] = await db.select().from(internalWorkflowImportsTable).where(eq(internalWorkflowImportsTable.fileHash, fileHash)).limit(1);
    if (duplicate?.status === "APPLIED") return void res.status(409).json({ error: "This exact CSV file has already been imported.", duplicateImportId: duplicate.publicId });

    const rows = parseCsv(csvText);
    const canonicalHeaders: Record<string, string> = {
      matterid: "MatterID", attorneyref: "AttorneyRef", title: "Title", type: "Type", status: "Status",
      attorney: "Attorney", paralegal: "Paralegal", client: "Client", clientref: "ClientRef",
      applicationnum: "ApplicationNum", patentnum: "PatentNum", ptostatus: "PTOStatus",
      nextexternaltask: "NextExternalTask", nextexternaltaskduedate: "NextExternalTaskDueDate",
      nextinternaltask: "NextInternalTask", nextinternaltaskduedate: "NextInternalTaskDueDate",
      opentaskcountexternal: "OpenTaskCountExternal", opentaskcountinternal: "OpenTaskCountInternal",
    };
    const headers = rows.shift()?.map((value) => {
      const clean = value.replace(/^\uFEFF/, "").trim();
      return canonicalHeaders[clean.toLowerCase()] ?? clean;
    }) ?? [];
    if (!rows.length) return void res.status(400).json({ error: "The CSV contains headers but no matter rows." });
    const headerIndex = new Map(headers.map((header, index) => [header.toLowerCase(), index]));
    if (!headerIndex.has("matterid")) return void res.status(400).json({ error: "This file is missing the required MatterID column." });
    const imported: AppCollMatterRecord[] = [];
    const exceptions: ImportException[] = [];
    const previewRows: Array<{ id: string; matterNumber: string; title: string; clientName: string; disposition: string; detail: string }> = [];
    const seen = new Set<string>();
    for (const [rowIndex, values] of rows.entries()) {
      const record: AppCollMatterRecord = {};
      headers.forEach((header, index) => { if (header) record[header] = values[index] ?? ""; });
      const matterId = record.MatterID?.trim() ?? "";
      if (!matterId) {
        exceptions.push({ row: rowIndex + 2, field: "MatterID", message: "MatterID is required; this row was not imported." });
        previewRows.push({ id: `row-${rowIndex + 2}`, matterNumber: record.AttorneyRef ?? "", title: record.Title ?? "", clientName: record.Client ?? "", disposition: "invalid", detail: "MatterID is required." });
      } else if (seen.has(matterId)) {
        exceptions.push({ row: rowIndex + 2, field: "MatterID", message: `Duplicate MatterID ${matterId}; the first row was retained.` });
        previewRows.push({ id: matterId, matterNumber: record.AttorneyRef ?? "", title: record.Title ?? "", clientName: record.Client ?? "", disposition: "duplicate", detail: "Duplicate row in this CSV; the first occurrence will be used." });
      } else {
        seen.add(matterId);
        for (const field of ["NextExternalTaskDueDate", "NextInternalTaskDueDate"]) {
          const value = record[field];
          if (value?.trim() && !toDate(value)) exceptions.push({ row: rowIndex + 2, field, message: `Unrecognized date "${value}"; saved as blank.` });
        }
        imported.push(record);
        previewRows.push({ id: matterId, matterNumber: record.AttorneyRef ?? "", title: record.Title ?? "", clientName: record.Client ?? "", disposition: "ready", detail: "" });
      }
    }
    const existing = await db.select().from(internalWorkflowMattersTable);
    const existingById = new Map(existing.map((matter) => [matter.appCollMatterId, matter]));
    let added = 0;
    let changed = 0;
    let unchanged = 0;
    for (const record of imported) {
      const prior = existingById.get(record.MatterID!.trim());
      if (!prior) added += 1;
      else if (JSON.stringify(Object.fromEntries(Object.entries(prior.rawRecord).sort())) !== JSON.stringify(Object.fromEntries(Object.entries(record).sort()))) changed += 1;
      else {
        unchanged += 1;
        const row = previewRows.find((item) => item.id === record.MatterID!.trim());
        if (row) {
          row.disposition = "duplicate";
          row.detail = "No AppColl fields have changed since the previous import.";
        }
      }
    }
    const included = new Set(imported.map((record) => record.MatterID!.trim()));
    const summary = { total: rows.length, added, changed, unchanged, invalid: exceptions.filter((item) => item.field === "MatterID").length, missing: existing.filter((matter) => !included.has(matter.appCollMatterId)).length };
    const [batch] = await db.insert(internalWorkflowImportsTable).values({
      fileName,
      fileHash,
      status: "REVIEW",
      previewData: imported,
      summary,
      exceptions,
      createdBy: req.portalUser!.id,
    }).returning();
    const preview: MatterPreview = { publicId: batch!.publicId, fileName, summary, exceptions };
    res.status(201).json({ preview, rows: previewRows.slice(0, 250), notice: "Missing matters are reported only; imports never delete matters." });
  } catch (error) {
    next(error);
  }
});

router.post("/portal/internal-workflow/imports/:importId/apply", requireAdmin, async (req, res, next) => {
  try {
    const publicId = typeof req.params.importId === "string" ? req.params.importId : "";
    if (!UUID.test(publicId)) return void res.status(400).json({ error: "Invalid import identifier." });
    const [batch] = await db.select().from(internalWorkflowImportsTable).where(eq(internalWorkflowImportsTable.publicId, publicId)).limit(1);
    if (!batch) return void res.status(404).json({ error: "Import preview not found." });
    if (batch.status !== "REVIEW" || !batch.previewData) return void res.status(409).json({ error: "This import is no longer awaiting confirmation." });
    const records = batch.previewData;
    await db.transaction(async (tx) => {
      for (const record of records) {
        const values = matterValues(record);
        await tx.insert(internalWorkflowMattersTable).values(values).onConflictDoUpdate({
          target: internalWorkflowMattersTable.appCollMatterId,
          set: values,
        });
      }
      await tx.update(internalWorkflowImportsTable).set({ status: "APPLIED", previewData: null, appliedAt: new Date() }).where(eq(internalWorkflowImportsTable.id, batch.id));
    });
    res.json({ applied: records.length, summary: batch.summary });
  } catch (error) {
    next(error);
  }
});

async function userCanReadMatter(user: NonNullable<Express.Request["portalUser"]>, matter: typeof internalWorkflowMattersTable.$inferSelect) {
  if (user.role === "ADMIN") return true;
  if (user.role === "PARALEGAL") return matter.paralegal.trim().toLowerCase() === user.name.trim().toLowerCase();
  const links = await db.select({ clientId: attorneyClientsTable.clientId }).from(attorneyClientsTable).where(eq(attorneyClientsTable.attorneyUserId, user.id));
  if (!links.length) return false;
  const clients = await db.select({ name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, links.map(({ clientId }) => clientId)));
  return clients.some(({ name }) => name.trim().toLowerCase() === matter.client.trim().toLowerCase());
}

router.get("/portal/internal-workflow/team", async (_req, res, next) => {
  try {
    const users = await db.select({
      id: portalUsersTable.id,
      publicId: portalUsersTable.publicId,
      name: portalUsersTable.name,
      email: portalUsersTable.email,
      role: portalUsersTable.role,
    }).from(portalUsersTable).where(and(
      eq(portalUsersTable.active, true),
      eq(portalUsersTable.status, "ACTIVE"),
      inArray(portalUsersTable.role, ["ATTORNEY", "PARALEGAL", "ADMIN"]),
    )).orderBy(asc(portalUsersTable.name));
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.get("/portal/internal-workflow/tasks", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const tasks = await db.select().from(internalWorkflowTasksTable)
      .where(user.role === "ADMIN" ? undefined : or(
        eq(internalWorkflowTasksTable.createdById, user.id),
        eq(internalWorkflowTasksTable.assignedById, user.id),
        eq(internalWorkflowTasksTable.assignedToId, user.id),
        eq(internalWorkflowTasksTable.responsibleAttorneyId, user.id),
      ))
      .orderBy(asc(internalWorkflowTasksTable.internalTargetDate), asc(internalWorkflowTasksTable.officialDueDate))
      .limit(500);
    const matters = tasks.length ? await db.select().from(internalWorkflowMattersTable).where(inArray(internalWorkflowMattersTable.id, tasks.map((task) => task.matterId).filter((id): id is number => id !== null))) : [];
    const users = tasks.length ? await db.select().from(portalUsersTable).where(inArray(portalUsersTable.id, [...new Set(tasks.flatMap((task) => [task.createdById, task.assignedById, task.assignedToId, task.responsibleAttorneyId].filter((id): id is number => id !== null)))])) : [];
    const matterMap = new Map(matters.map((matter) => [matter.id, matter]));
    const userMap = new Map(users.map((entry) => [entry.id, entry]));
    res.json({ tasks: tasks.map((task) => {
      const matter = task.matterId ? matterMap.get(task.matterId) : null;
      return {
        publicId: task.publicId, title: task.title, instructions: task.instructions,
        matter: matter ? { publicId: matter.publicId, docketId: matter.docketId, title: matter.title, client: matter.client } : null,
        responsibleAttorney: task.responsibleAttorneyId ? userMap.get(task.responsibleAttorneyId)?.name ?? "" : "",
        createdBy: userMap.get(task.createdById)?.name ?? "",
        assignedBy: userMap.get(task.assignedById)?.name ?? "",
        assignedTo: { publicId: userMap.get(task.assignedToId)?.publicId ?? "", name: userMap.get(task.assignedToId)?.name ?? "" },
        assignedToId: task.assignedToId,
        assignedToPublicId: userMap.get(task.assignedToId)?.publicId ?? "",
        createdById: task.createdById,
        createdByPublicId: userMap.get(task.createdById)?.publicId ?? "",
        assignedById: task.assignedById,
        assignedByPublicId: userMap.get(task.assignedById)?.publicId ?? "",
        responsibleAttorneyId: task.responsibleAttorneyId,
        responsibleAttorneyPublicId: task.responsibleAttorneyId ? userMap.get(task.responsibleAttorneyId)?.publicId ?? null : null,
        officialDueDate: task.officialDueDate,
        internalTargetDate: task.internalTargetDate,
        workflowStatus: ({ OPEN: "PENDING_WITH_ME", IN_PROGRESS: "ASSIGNED_WITH_ANOTHER", RETURNED_FOR_PROOF: "READY_FOR_PROOF", COMPLETED: "FINALIZED" } as Record<string, string>)[task.workflowStatus] ?? task.workflowStatus,
        strategyStatus: task.strategyStatus,
        priority: task.priority,
        createdAt: task.createdAt,
        finalizedAt: task.finalizedAt,
        canReassign: user.role === "ADMIN" || task.createdById === user.id || task.assignedById === user.id,
      };
    }) });
  } catch (error) {
    next(error);
  }
});

router.post("/portal/internal-workflow/tasks", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 240) : "";
    const instructions = typeof req.body?.instructions === "string" ? req.body.instructions.trim().slice(0, 12000) : "";
    const assignedToId = Number(req.body?.assignedToId);
    const matterPublicId = typeof req.body?.matterPublicId === "string" ? req.body.matterPublicId : "";
    const requestedResponsibleAttorneyId = req.body?.responsibleAttorneyId === undefined
      ? (user.role === "ATTORNEY" ? user.id : 0)
      : Number(req.body.responsibleAttorneyId);
    const officialDueDate = typeof req.body?.officialDueDate === "string" ? toDate(req.body.officialDueDate) : null;
    const internalTargetDate = typeof req.body?.internalTargetDate === "string" ? toDate(req.body.internalTargetDate) : null;
    const priority = ["LOW", "NORMAL", "HIGH", "URGENT"].includes(req.body?.priority) ? req.body.priority : "NORMAL";
    if (title.length < 3 || !Number.isInteger(assignedToId) || assignedToId < 1) return void res.status(400).json({ error: "Enter a task title and select an assignee." });
    const [assignee] = await db.select().from(portalUsersTable).where(and(
      eq(portalUsersTable.id, assignedToId),
      eq(portalUsersTable.active, true),
      eq(portalUsersTable.status, "ACTIVE"),
      inArray(portalUsersTable.role, ["ATTORNEY", "PARALEGAL", "ADMIN"]),
    )).limit(1);
    if (!assignee) return void res.status(400).json({ error: "Select an active attorney or administrator." });
    const [responsibleAttorney] = await db.select({ id: portalUsersTable.id }).from(portalUsersTable).where(and(
      eq(portalUsersTable.id, requestedResponsibleAttorneyId),
      eq(portalUsersTable.active, true),
      eq(portalUsersTable.status, "ACTIVE"),
      eq(portalUsersTable.role, "ATTORNEY"),
    )).limit(1);
    if (!responsibleAttorney) return void res.status(400).json({ error: "Select an active attorney responsible for the assignment." });
    let matter: typeof internalWorkflowMattersTable.$inferSelect | undefined;
    if (matterPublicId) {
      [matter] = await db.select().from(internalWorkflowMattersTable).where(eq(internalWorkflowMattersTable.publicId, matterPublicId)).limit(1);
      if (!matter || !(await userCanReadMatter(user, matter))) return void res.status(404).json({ error: "Matter not found or not assigned to you." });
    }
    const responsibleAttorneyId = requestedResponsibleAttorneyId;
    const [task] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(internalWorkflowTasksTable).values({
        matterId: matter?.id ?? null, title, instructions, responsibleAttorneyId,
        createdById: user.id, assignedById: user.id, assignedToId,
        workflowStatus: assignedToId === user.id ? "PENDING_WITH_ME" : "ASSIGNED_WITH_ANOTHER",
        officialDueDate, internalTargetDate, priority,
      }).returning();
      await tx.insert(internalWorkflowTaskAuditTable).values({
        taskId: created!.id, actorId: user.id, action: "CREATED",
        details: { title, matterId: matter?.publicId ?? null, assignedTo: assignee.publicId },
      });
      if (assignedToId !== user.id) await notifyUser(tx, assignedToId, created!.id, "New assignment", title);
      return [created];
    });
    res.status(201).json({ task: { publicId: task!.publicId, title: task!.title, workflowStatus: task!.workflowStatus } });
  } catch (error) {
    next(error);
  }
});

router.patch("/portal/internal-workflow/tasks/:taskId", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const publicId = typeof req.params.taskId === "string" ? req.params.taskId : "";
    if (!UUID.test(publicId)) return void res.status(400).json({ error: "Invalid task identifier." });
    const [task] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.publicId, publicId)).limit(1);
    if (!task) return void res.status(404).json({ error: "Task not found." });
    const mayReassign = user.role === "ADMIN" || task.createdById === user.id || task.assignedById === user.id;
    const isParticipant = mayReassign || task.assignedToId === user.id || task.responsibleAttorneyId === user.id;
    if (!isParticipant) return void res.status(404).json({ error: "Task not found." });
    const status = typeof req.body?.workflowStatus === "string" ? req.body.workflowStatus : task.workflowStatus;
    if (![...workflowStatuses, "OPEN", "IN_PROGRESS", "RETURNED_FOR_PROOF", "COMPLETED"].includes(status as never)) return void res.status(400).json({ error: "Invalid workflow status." });
    const strategyStatus = typeof req.body?.strategyStatus === "string" ? req.body.strategyStatus : task.strategyStatus;
    if (!strategyStatuses.includes(strategyStatus as typeof strategyStatuses[number])) return void res.status(400).json({ error: "Invalid strategy status." });
    let assignedToId = task.assignedToId;
    if (req.body?.assignedToId !== undefined) {
      if (!mayReassign) return void res.status(403).json({ error: "Only the task creator or delegator may reassign this task." });
      assignedToId = Number(req.body.assignedToId);
      const [assignee] = await db.select({ id: portalUsersTable.id }).from(portalUsersTable).where(and(
        eq(portalUsersTable.id, assignedToId), eq(portalUsersTable.active, true), eq(portalUsersTable.status, "ACTIVE"),
        inArray(portalUsersTable.role, ["ATTORNEY", "PARALEGAL", "ADMIN"]),
      )).limit(1);
      if (!assignee) return void res.status(400).json({ error: "Select an active attorney or administrator." });
    }
    const nextDate = typeof req.body?.internalTargetDate === "string" ? toDate(req.body.internalTargetDate) : task.internalTargetDate;
    const finalizedAt = ["COMPLETED", "FINALIZED"].includes(status) ? task.finalizedAt ?? new Date() : null;
    await db.transaction(async (tx) => {
      await tx.update(internalWorkflowTasksTable).set({
        workflowStatus: status, strategyStatus, assignedToId,
        assignedById: assignedToId !== task.assignedToId ? user.id : task.assignedById,
        internalTargetDate: nextDate, finalizedAt, updatedAt: new Date(),
      }).where(eq(internalWorkflowTasksTable.id, task.id));
      await tx.insert(internalWorkflowTaskAuditTable).values({
        taskId: task.id, actorId: user.id,
        action: assignedToId !== task.assignedToId ? "REASSIGNED" : "UPDATED",
        details: { fromStatus: task.workflowStatus, toStatus: status, internalTargetDate: nextDate, assignedToId },
      });
      if (assignedToId !== task.assignedToId) await notifyUser(tx, assignedToId, task.id, "Assignment delegated", task.title);
      if (status !== task.workflowStatus && task.responsibleAttorneyId && task.responsibleAttorneyId !== user.id) {
        await notifyUser(tx, task.responsibleAttorneyId, task.id, "Task status changed", `${task.title}: ${statusLabelsForNotification(status)}`);
      }
    });
    res.json({ updated: true });
  } catch (error) {
    next(error);
  }
});

router.get("/portal/internal-workflow/tasks/:taskId/details", async (req, res, next) => {
  try {
    const [task] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.publicId, String(req.params.taskId))).limit(1);
    if (!task || !(await canReadTask(req.portalUser!.id, req.portalUser!.role, task))) return void res.status(404).json({ error: "Task not found." });
    const [children, comments, audit, contributors] = await Promise.all([
      db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.parentTaskId, task.id)).orderBy(asc(internalWorkflowTasksTable.createdAt)),
      db.select().from(internalWorkflowCommentsTable).where(eq(internalWorkflowCommentsTable.taskId, task.id)).orderBy(asc(internalWorkflowCommentsTable.createdAt)),
      db.select().from(internalWorkflowTaskAuditTable).where(eq(internalWorkflowTaskAuditTable.taskId, task.id)).orderBy(asc(internalWorkflowTaskAuditTable.createdAt)),
      db.select().from(internalWorkflowContributorsTable).where(eq(internalWorkflowContributorsTable.taskId, task.id)),
    ]);
    const userIds = [...new Set([...comments.map((item) => item.authorId), ...audit.map((item) => item.actorId), ...contributors.map((item) => item.userId), ...children.flatMap((item) => [item.assignedToId, item.createdById])])];
    const users = userIds.length ? await db.select().from(portalUsersTable).where(inArray(portalUsersTable.id, userIds)) : [];
    const names = new Map(users.map((person) => [person.id, person.name]));
    res.json({
      comments: comments.map((item) => ({ publicId: item.publicId, body: item.body, author: names.get(item.authorId) ?? "Staff", createdAt: item.createdAt })),
      activity: audit.map((item) => ({ action: item.action, actor: names.get(item.actorId) ?? "Staff", details: item.details, createdAt: item.createdAt })),
      children: children.map((item) => ({ publicId: item.publicId, title: item.title, assignedTo: names.get(item.assignedToId) ?? "Staff", status: item.workflowStatus, internalTargetDate: item.internalTargetDate })),
      contributors: contributors.map((item) => ({ userId: item.userId, name: names.get(item.userId) ?? "Staff", allocationCents: item.allocationCents, notes: item.notes })),
    });
  } catch (error) { next(error); }
});

router.post("/portal/internal-workflow/tasks/:taskId/children", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const [parent] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.publicId, String(req.params.taskId))).limit(1);
    if (!parent || !(await canReadTask(user.id, user.role, parent))) return void res.status(404).json({ error: "Parent task not found." });
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 240) : "";
    const assignedToId = Number(req.body?.assignedToId);
    if (title.length < 3) return void res.status(400).json({ error: "Enter a subtask title." });
    const [assignee] = await db.select({ id: portalUsersTable.id }).from(portalUsersTable).where(and(eq(portalUsersTable.id, assignedToId), eq(portalUsersTable.active, true), eq(portalUsersTable.status, "ACTIVE"), inArray(portalUsersTable.role, ["ATTORNEY", "PARALEGAL", "ADMIN"]))).limit(1);
    if (!assignee) return void res.status(400).json({ error: "Choose an active colleague." });
    const [child] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(internalWorkflowTasksTable).values({
        parentTaskId: parent.id, matterId: parent.matterId, title, instructions: typeof req.body?.instructions === "string" ? req.body.instructions.trim().slice(0, 12000) : "",
        responsibleAttorneyId: parent.responsibleAttorneyId, createdById: user.id, assignedById: user.id, assignedToId,
        officialDueDate: parent.officialDueDate, internalTargetDate: typeof req.body?.internalTargetDate === "string" ? toDate(req.body.internalTargetDate) : parent.internalTargetDate,
        workflowStatus: assignedToId === user.id ? "PENDING_WITH_ME" : "ASSIGNED_WITH_ANOTHER",
      }).returning();
      await tx.insert(internalWorkflowTaskAuditTable).values({ taskId: created!.id, actorId: user.id, action: "CREATED", details: { parentTaskId: parent.publicId } });
      if (assignedToId !== user.id) await notifyUser(tx, assignedToId, created!.id, "New subtask", title);
      return [created];
    });
    res.status(201).json({ publicId: child!.publicId });
  } catch (error) { next(error); }
});

router.post("/portal/internal-workflow/tasks/:taskId/contributors", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const [task] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.publicId, String(req.params.taskId))).limit(1);
    if (!task || !(await canReadTask(user.id, user.role, task))) return void res.status(404).json({ error: "Task not found." });
    const mayManage = user.role === "ADMIN" || task.createdById === user.id || task.assignedById === user.id || task.responsibleAttorneyId === user.id;
    if (!mayManage) return void res.status(403).json({ error: "Only the task lead, responsible attorney, or administrator can add contributors." });
    const userId = Number(req.body?.userId);
    const allocationCents = Number(req.body?.allocationCents ?? 0);
    const [contributor] = await db.select({ id: portalUsersTable.id }).from(portalUsersTable).where(and(eq(portalUsersTable.id, userId), eq(portalUsersTable.active, true), eq(portalUsersTable.status, "ACTIVE"), inArray(portalUsersTable.role, ["ATTORNEY", "PARALEGAL"]))).limit(1);
    if (!contributor || !Number.isInteger(allocationCents) || allocationCents < 0 || allocationCents > 100000000) return void res.status(400).json({ error: "Choose an active practitioner and valid allocation." });
    await db.insert(internalWorkflowContributorsTable).values({ taskId: task.id, userId, allocationCents, notes: typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 1000) : "" }).onConflictDoUpdate({
      target: [internalWorkflowContributorsTable.taskId, internalWorkflowContributorsTable.userId],
      set: { allocationCents, notes: typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 1000) : "" },
    });
    await db.insert(internalWorkflowTaskAuditTable).values({ taskId: task.id, actorId: user.id, action: "CONTRIBUTOR_UPDATED", details: { userId, allocationCents } });
    res.status(201).json({ updated: true });
  } catch (error) { next(error); }
});

router.get("/portal/internal-workflow/tasks/:taskId/comments", async (req, res, next) => {
  try {
    const [task] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.publicId, String(req.params.taskId))).limit(1);
    if (!task || !(await canReadTask(req.portalUser!.id, req.portalUser!.role, task))) return void res.status(404).json({ error: "Task not found." });
    const comments = await db.select().from(internalWorkflowCommentsTable).where(eq(internalWorkflowCommentsTable.taskId, task.id)).orderBy(asc(internalWorkflowCommentsTable.createdAt));
    const users = comments.length ? await db.select().from(portalUsersTable).where(inArray(portalUsersTable.id, [...new Set(comments.map((comment) => comment.authorId))])) : [];
    const names = new Map(users.map((user) => [user.id, user.name]));
    res.json({ comments: comments.map((comment) => ({ publicId: comment.publicId, body: comment.body, author: names.get(comment.authorId) ?? "Staff", createdAt: comment.createdAt })) });
  } catch (error) { next(error); }
});

router.post("/portal/internal-workflow/tasks/:taskId/comments", async (req, res, next) => {
  try {
    const [task] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.publicId, String(req.params.taskId))).limit(1);
    if (!task || !(await canReadTask(req.portalUser!.id, req.portalUser!.role, task))) return void res.status(404).json({ error: "Task not found." });
    const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0, 5000) : "";
    if (!body) return void res.status(400).json({ error: "Comment cannot be empty." });
    const [comment] = await db.insert(internalWorkflowCommentsTable).values({ taskId: task.id, authorId: req.portalUser!.id, body }).returning();
    await db.insert(internalWorkflowTaskAuditTable).values({ taskId: task.id, actorId: req.portalUser!.id, action: "COMMENTED", details: {} });
    res.status(201).json({ comment: { publicId: comment!.publicId, body, createdAt: comment!.createdAt } });
  } catch (error) { next(error); }
});

router.get("/portal/internal-workflow/time-entries", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const responsibleTasks = user.role === "ADMIN" ? [] : await db.select({ id: internalWorkflowTasksTable.id }).from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.responsibleAttorneyId, user.id));
    const entries = await db.select().from(internalWorkflowTimeEntriesTable)
      .where(user.role === "ADMIN" ? undefined : responsibleTasks.length
        ? or(eq(internalWorkflowTimeEntriesTable.userId, user.id), inArray(internalWorkflowTimeEntriesTable.taskId, responsibleTasks.map((task) => task.id)))
        : eq(internalWorkflowTimeEntriesTable.userId, user.id))
      .orderBy(asc(internalWorkflowTimeEntriesTable.workDate));
    const taskRows = entries.length ? await db.select().from(internalWorkflowTasksTable).where(inArray(internalWorkflowTasksTable.id, [...new Set(entries.map((entry) => entry.taskId))])) : [];
    const taskMap = new Map(taskRows.map((task) => [task.id, task]));
    res.json({ entries: entries.reverse().map((entry) => ({ publicId: entry.publicId, taskPublicId: taskMap.get(entry.taskId)?.publicId, taskTitle: taskMap.get(entry.taskId)?.title ?? "", workDate: entry.workDate, minutes: entry.minutes, narrative: entry.narrative, billable: entry.billable, billingCode: entry.billingCode, rateCents: entry.rateCents, amountCents: entry.amountCents, approvalStatus: entry.approvalStatus, exportedAt: entry.exportedAt, canReview: user.role === "ADMIN" || taskMap.get(entry.taskId)?.responsibleAttorneyId === user.id })) });
  } catch (error) { next(error); }
});

router.post("/portal/internal-workflow/time-entries", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const [task] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.publicId, String(req.body?.taskPublicId ?? ""))).limit(1);
    if (!task || !(await canReadTask(user.id, user.role, task))) return void res.status(404).json({ error: "Task not found." });
    const minutes = Number(req.body?.minutes);
    const rateCents = Number(req.body?.rateCents ?? 0);
    const workDate = typeof req.body?.workDate === "string" ? toDate(req.body.workDate) : null;
    const narrative = typeof req.body?.narrative === "string" ? req.body.narrative.trim().slice(0, 2000) : "";
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440 || !Number.isInteger(rateCents) || rateCents < 0 || rateCents > 10000000 || !workDate) return void res.status(400).json({ error: "Enter a valid date, duration, and hourly rate." });
    const billable = req.body?.billable !== false;
    const [entry] = await db.insert(internalWorkflowTimeEntriesTable).values({
      taskId: task.id, userId: user.id, workDate, minutes, narrative, billable,
      billingCode: typeof req.body?.billingCode === "string" ? req.body.billingCode.trim().slice(0, 40) || "PROSECUTION" : "PROSECUTION",
      rateCents: billable ? rateCents : 0, amountCents: billable ? Math.round(minutes * rateCents / 60) : 0,
    }).returning();
    res.status(201).json({ publicId: entry!.publicId });
  } catch (error) { next(error); }
});

router.patch("/portal/internal-workflow/time-entries/:entryId/review", async (req, res, next) => {
  try {
    const [entry] = await db.select().from(internalWorkflowTimeEntriesTable).where(eq(internalWorkflowTimeEntriesTable.publicId, String(req.params.entryId))).limit(1);
    if (!entry) return void res.status(404).json({ error: "Time entry not found." });
    const [task] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.id, entry.taskId)).limit(1);
    const user = req.portalUser!;
    if (!task || (user.role !== "ADMIN" && task.responsibleAttorneyId !== user.id)) return void res.status(403).json({ error: "Billing review is limited to the responsible attorney or an administrator." });
    const status = req.body?.status;
    if (status !== "APPROVED" && status !== "RETURNED") return void res.status(400).json({ error: "Choose approve or return." });
    await db.update(internalWorkflowTimeEntriesTable).set({ approvalStatus: status, reviewedById: user.id, reviewedAt: new Date() }).where(eq(internalWorkflowTimeEntriesTable.id, entry.id));
    res.json({ updated: true });
  } catch (error) { next(error); }
});

router.get("/portal/internal-workflow/timer", async (req, res, next) => {
  try {
    const [session] = await db.select().from(internalWorkflowTimerSessionsTable).where(and(eq(internalWorkflowTimerSessionsTable.userId, req.portalUser!.id), inArray(internalWorkflowTimerSessionsTable.state, ["RUNNING", "PAUSED"]))).limit(1);
    const [task] = session ? await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.id, session.taskId)).limit(1) : [];
    res.json({ timer: session && task ? { state: session.state, accumulatedSeconds: session.accumulatedSeconds, resumedAt: session.resumedAt, taskPublicId: task.publicId, taskTitle: task.title } : null });
  } catch (error) { next(error); }
});

router.post("/portal/internal-workflow/timer", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    const action = req.body?.action;
    const [session] = await db.select().from(internalWorkflowTimerSessionsTable).where(and(eq(internalWorkflowTimerSessionsTable.userId, user.id), inArray(internalWorkflowTimerSessionsTable.state, ["RUNNING", "PAUSED"]))).limit(1);
    if (action === "start") {
      const [task] = await db.select().from(internalWorkflowTasksTable).where(eq(internalWorkflowTasksTable.publicId, String(req.body?.taskPublicId ?? ""))).limit(1);
      if (!task || !(await canReadTask(user.id, user.role, task))) return void res.status(404).json({ error: "Task not found." });
      if (session) return void res.status(409).json({ error: "Stop or pause your current timer before starting another." });
      const [created] = await db.insert(internalWorkflowTimerSessionsTable).values({ userId: user.id, taskId: task.id }).returning();
      return void res.status(201).json({ timer: created });
    }
    if (!session) return void res.status(404).json({ error: "No running timer." });
    if (action === "pause" && session.state === "RUNNING") {
      const seconds = Math.max(0, Math.floor((Date.now() - session.resumedAt.getTime()) / 1000));
      await db.update(internalWorkflowTimerSessionsTable).set({ state: "PAUSED", accumulatedSeconds: session.accumulatedSeconds + seconds }).where(eq(internalWorkflowTimerSessionsTable.id, session.id));
    } else if (action === "resume" && session.state === "PAUSED") {
      await db.update(internalWorkflowTimerSessionsTable).set({ state: "RUNNING", resumedAt: new Date() }).where(eq(internalWorkflowTimerSessionsTable.id, session.id));
    } else if (action === "stop") {
      const seconds = session.accumulatedSeconds + (session.state === "RUNNING" ? Math.max(0, Math.floor((Date.now() - session.resumedAt.getTime()) / 1000)) : 0);
      const minutes = Math.max(1, Math.round(seconds / 60));
      const workDate = new Date().toISOString().slice(0, 10);
      await db.transaction(async (tx) => {
        await tx.update(internalWorkflowTimerSessionsTable).set({ state: "STOPPED", accumulatedSeconds: seconds }).where(eq(internalWorkflowTimerSessionsTable.id, session.id));
        const rateCents = Number.isInteger(req.body?.rateCents) && req.body.rateCents >= 0 ? Math.min(req.body.rateCents, 10000000) : 0;
        await tx.insert(internalWorkflowTimeEntriesTable).values({ taskId: session.taskId, userId: user.id, workDate, minutes, narrative: "Timer entry", billable: true, billingCode: typeof req.body?.billingCode === "string" ? req.body.billingCode.slice(0, 40) : "PROSECUTION", rateCents, amountCents: Math.round(minutes * rateCents / 60) });
      });
    } else return void res.status(400).json({ error: "That timer action is not available." });
    res.json({ updated: true });
  } catch (error) { next(error); }
});

router.get("/portal/internal-workflow/reports", async (req, res, next) => {
  try {
    if (req.portalUser!.role !== "ADMIN") return void res.status(403).json({ error: "Management reports are restricted to administrators." });
    const [tasks, entries, team] = await Promise.all([
      db.select().from(internalWorkflowTasksTable),
      db.select().from(internalWorkflowTimeEntriesTable),
      db.select({ id: portalUsersTable.id, name: portalUsersTable.name, role: portalUsersTable.role }).from(portalUsersTable).where(and(eq(portalUsersTable.active, true), eq(portalUsersTable.status, "ACTIVE"))),
    ]);
    const byUser = team.map((person) => ({ name: person.name, role: person.role, assigned: tasks.filter((task) => task.assignedToId === person.id && task.workflowStatus !== "FINALIZED" && task.workflowStatus !== "COMPLETED").length, minutes: entries.filter((entry) => entry.userId === person.id).reduce((sum, entry) => sum + entry.minutes, 0) }));
    res.json({ totals: { active: tasks.filter((task) => !["FINALIZED", "COMPLETED"].includes(task.workflowStatus)).length, overdue: tasks.filter((task) => task.internalTargetDate && task.internalTargetDate < new Date().toISOString().slice(0, 10) && !["FINALIZED", "COMPLETED"].includes(task.workflowStatus)).length, pendingBilling: entries.filter((entry) => entry.approvalStatus === "PENDING").length, approvedCents: entries.filter((entry) => entry.approvalStatus === "APPROVED").reduce((sum, entry) => sum + entry.amountCents, 0), exportedCents: entries.filter((entry) => entry.exportedAt).reduce((sum, entry) => sum + entry.amountCents, 0) }, byUser });
  } catch (error) { next(error); }
});

router.post("/portal/internal-workflow/billing/export", async (req, res, next) => {
  try {
    const user = req.portalUser!;
    if (user.role !== "ADMIN") return void res.status(403).json({ error: "Billing export is restricted to administrators." });
    const entries = await db.select().from(internalWorkflowTimeEntriesTable).where(eq(internalWorkflowTimeEntriesTable.approvalStatus, "APPROVED"));
    if (!entries.length) return void res.status(409).json({ error: "There are no approved, unexported time entries." });
    const tasks = await db.select().from(internalWorkflowTasksTable).where(inArray(internalWorkflowTasksTable.id, [...new Set(entries.map((entry) => entry.taskId))]));
    const matterIds = [...new Set(tasks.map((task) => task.matterId).filter((id): id is number => id !== null))];
    const matters = matterIds.length ? await db.select().from(internalWorkflowMattersTable).where(inArray(internalWorkflowMattersTable.id, matterIds)) : [];
    const users = await db.select().from(portalUsersTable).where(inArray(portalUsersTable.id, [...new Set(entries.map((entry) => entry.userId))]));
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const matterMap = new Map(matters.map((matter) => [matter.id, matter]));
    const userMap = new Map(users.map((person) => [person.id, person]));
    const q = (value: unknown) => {
      let text = String(value ?? "");
      if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = ["Client,MatterID,AttorneyRef,Responsible Attorney,Practitioner,Date,Billing Code,Narrative,Hours,Amount,Approval Status", ...entries.map((entry) => {
      const task = taskMap.get(entry.taskId);
      const practitioner = userMap.get(entry.userId);
      const matter = task?.matterId ? matterMap.get(task.matterId) : undefined;
      return [matter?.client ?? "", matter?.appCollMatterId ?? "", matter?.docketId ?? "", task?.responsibleAttorneyId ? userMap.get(task.responsibleAttorneyId)?.name : "", practitioner?.name, entry.workDate, entry.billingCode, entry.narrative, (entry.minutes / 60).toFixed(2), (entry.amountCents / 100).toFixed(2), entry.approvalStatus].map(q).join(",");
    })].join("\r\n");
    await db.update(internalWorkflowTimeEntriesTable).set({ approvalStatus: "EXPORTED", exportedAt: new Date() }).where(inArray(internalWorkflowTimeEntriesTable.id, entries.map((entry) => entry.id)));
    res.json({ csv, exported: entries.length });
  } catch (error) { next(error); }
});

router.get("/portal/internal-workflow/notifications", async (req, res, next) => {
  try {
    const rows = await db.select().from(internalWorkflowNotificationsTable).where(eq(internalWorkflowNotificationsTable.userId, req.portalUser!.id)).orderBy(asc(internalWorkflowNotificationsTable.createdAt)).limit(100);
    res.json({ notifications: rows.reverse() });
  } catch (error) { next(error); }
});

router.patch("/portal/internal-workflow/notifications/:notificationId/read", async (req, res, next) => {
  try {
    await db.update(internalWorkflowNotificationsTable).set({ readAt: new Date() }).where(and(eq(internalWorkflowNotificationsTable.publicId, String(req.params.notificationId)), eq(internalWorkflowNotificationsTable.userId, req.portalUser!.id)));
    res.json({ updated: true });
  } catch (error) { next(error); }
});

export default router;
