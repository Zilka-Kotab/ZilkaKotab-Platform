import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import {
  db,
  internalWorkflowImportsTable,
  internalWorkflowMattersTable,
  type AppCollMatterRecord,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/portalAccess";

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

router.use(requireAdmin);

router.get("/portal/internal-workflow/matters", async (_req, res, next) => {
  try {
    const matters = await db.select().from(internalWorkflowMattersTable).orderBy(asc(internalWorkflowMattersTable.docketId));
    res.json({ matters: matters.map(serializeMatter) });
  } catch (error) {
    next(error);
  }
});

router.get("/portal/internal-workflow/imports", async (_req, res, next) => {
  try {
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

router.post("/portal/internal-workflow/imports/preview", async (req, res, next) => {
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

router.post("/portal/internal-workflow/imports/:importId/apply", async (req, res, next) => {
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

export default router;
