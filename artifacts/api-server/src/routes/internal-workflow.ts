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

router.use(requirePortalAccess, (req, res, next) => {
  if (req.portalUser?.role !== "ATTORNEY" && req.portalUser?.role !== "ADMIN") {
    res.status(403).json({ error: "Internal workflow access is restricted to firm staff." });
    return;
  }
  next();
});

router.get("/portal/internal-workflow/matters", async (_req, res, next) => {
  try {
    const user = _req.portalUser!;
    let matters = await db.select().from(internalWorkflowMattersTable).orderBy(asc(internalWorkflowMattersTable.docketId));
    if (user.role !== "ADMIN") {
      const clientIds = await db.select({ id: attorneyClientsTable.clientId }).from(attorneyClientsTable).where(eq(attorneyClientsTable.attorneyUserId, user.id));
      const clients = clientIds.length
        ? await db.select({ name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds.map(({ id }) => id)))
        : [];
      const names = new Set(clients.map(({ name }) => name.trim().toLowerCase()));
      matters = matters.filter((matter) => names.has(matter.client.trim().toLowerCase()));
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
      inArray(portalUsersTable.role, ["ATTORNEY", "ADMIN"]),
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
        workflowStatus: task.workflowStatus,
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
      inArray(portalUsersTable.role, ["ATTORNEY", "ADMIN"]),
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
        officialDueDate, internalTargetDate, priority,
      }).returning();
      await tx.insert(internalWorkflowTaskAuditTable).values({
        taskId: created!.id, actorId: user.id, action: "CREATED",
        details: { title, matterId: matter?.publicId ?? null, assignedTo: assignee.publicId },
      });
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
    if (!["OPEN", "IN_PROGRESS", "RETURNED_FOR_PROOF", "COMPLETED"].includes(status)) return void res.status(400).json({ error: "Invalid workflow status." });
    let assignedToId = task.assignedToId;
    if (req.body?.assignedToId !== undefined) {
      if (!mayReassign) return void res.status(403).json({ error: "Only the task creator or delegator may reassign this task." });
      assignedToId = Number(req.body.assignedToId);
      const [assignee] = await db.select({ id: portalUsersTable.id }).from(portalUsersTable).where(and(
        eq(portalUsersTable.id, assignedToId), eq(portalUsersTable.active, true), eq(portalUsersTable.status, "ACTIVE"),
        inArray(portalUsersTable.role, ["ATTORNEY", "ADMIN"]),
      )).limit(1);
      if (!assignee) return void res.status(400).json({ error: "Select an active attorney or administrator." });
    }
    const nextDate = typeof req.body?.internalTargetDate === "string" ? toDate(req.body.internalTargetDate) : task.internalTargetDate;
    const finalizedAt = status === "COMPLETED" ? task.finalizedAt ?? new Date() : null;
    await db.transaction(async (tx) => {
      await tx.update(internalWorkflowTasksTable).set({
        workflowStatus: status, assignedToId,
        assignedById: assignedToId !== task.assignedToId ? user.id : task.assignedById,
        internalTargetDate: nextDate, finalizedAt, updatedAt: new Date(),
      }).where(eq(internalWorkflowTasksTable.id, task.id));
      await tx.insert(internalWorkflowTaskAuditTable).values({
        taskId: task.id, actorId: user.id,
        action: assignedToId !== task.assignedToId ? "REASSIGNED" : "UPDATED",
        details: { fromStatus: task.workflowStatus, toStatus: status, internalTargetDate: nextDate, assignedToId },
      });
    });
    res.json({ updated: true });
  } catch (error) {
    next(error);
  }
});

export default router;
