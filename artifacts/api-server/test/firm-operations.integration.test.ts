import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool, portalUsersTable, firmWorkflowRowsTable as rows, firmBillingItemsTable as bills,
  firmPaymentsTable as payments, internalWorkflowDocketTasksTable as docket,
  internalWorkflowMattersTable as matters, firmWorkflowStatusHistoryTable as history,
} from "@workspace/db";
import operations from "../src/routes/firm-operations";
import { ensureFirmOperationsSchema } from "../src/lib/firm-operations-schema";

// Explicit opt-in: creates/cleans synthetic records in the development database only.
test("CSV -> assignment -> milestones -> one billing row -> invoice -> partial receipts", { skip: process.env.RUN_FIRM_OPERATIONS_DB_TEST !== "1" }, async () => {
  await ensureFirmOperationsSchema();
  const marker = `ops-test-${randomUUID()}`;
  const users = await db.insert(portalUsersTable).values(
    (["ADMIN", "ATTORNEY", "CLIENT"] as const).map((role) => ({
      email: `${marker}-${role.toLowerCase()}@example.invalid`, name: `${marker} ${role}`,
      role, status: "ACTIVE" as const, active: true, microsoftTenantId: randomUUID(), microsoftObjectId: randomUUID(),
    })),
  ).returning();
  const [admin, attorney, client] = users;
  const app = express();
  app.use(express.json());
  // Test-only identity provider. Real requirePortalAccess still resolves each seeded identity.
  app.use((req, _res, next) => {
    const user = users.find((u) => String(u.id) === req.headers["x-test-actor"]);
    req.isAuthenticated = (() => !!req.user) as typeof req.isAuthenticated;
    if (user) req.user = { id: user.publicId, tenantId: user.microsoftTenantId!, objectId: user.microsoftObjectId!, email: user.email, displayName: user.name, firstName: null, lastName: null };
    next();
  });
  app.use(operations);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(500).json({ error: err.message }); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.on("listening", resolve));
  const address = server.address() as import("node:net").AddressInfo;
  const request = async (path: string, method = "GET", body?: unknown, actor = admin!) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/portal/operations${path}`, {
      method, headers: { "content-type": "application/json", "x-test-actor": String(actor.id) }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() as any };
  };
  try {
    assert.equal((await request("", "GET", undefined, client!)).status, 403);
    const taskCsv = `TaskID,Matter,TaskType,Client,Owner,RespondBy,TaskStatus,ClosedOn\n${marker},${marker},Office Action Response,${marker},,2026-03-31,Open,`;
    const payload = { fileName: "tasks.csv", csvText: taskCsv, preview: true };
    const preview = await request("/import", "POST", payload);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.added, 1);
    assert.equal(preview.body.applied, false);
    assert.equal((await request("/import", "POST", { ...payload, preview: false }, attorney!)).status, 403);
    const applied = await request("/import", "POST", { ...payload, preview: false });
    assert.equal(applied.body.applied, true);
    const workspace = await request("");
    let row = workspace.body.rows.find((r: any) => r.matter === marker);
    assert.ok(row);
    assert.equal(row.filedOn, null);
    assert.equal((await request(`/rows/${row.publicId}`, "PATCH", { revision: row.revision, assignedToId: attorney!.id })).status, 200);
    assert.equal((await request(`/rows/${row.publicId}`, "PATCH", { revision: row.revision, notes: "stale" })).status, 409);
    row = (await request("", "GET", undefined, attorney!)).body.rows.find((r: any) => r.publicId === row.publicId);
    assert.ok(row, "internal assignment grants scoped access without granting other client records");
    const updated = await request(`/rows/${row.publicId}`, "PATCH", {
      revision: row.revision, strategySentOn: "2026-03-01", clientApprovalSentOn: "2026-03-10", paralegalSentOn: "2026-03-20", filedOn: "2026-03-25",
    }, attorney!);
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal((await request(`/rows/${row.publicId}`, "PATCH", { revision: row.revision + 1, strategySentOn: "2026-02-30" }, attorney!)).status, 400);
    // A re-import changes only source due dates, never ownership or recorded milestones.
    await request("/import", "POST", { ...payload, csvText: taskCsv.replace("2026-03-31", "2026-04-30"), preview: false });
    row = (await request("", "GET", undefined, attorney!)).body.rows.find((r: any) => r.publicId === row.publicId);
    assert.equal(row.assignedToId, attorney!.id);
    assert.equal(row.strategySentOn, "2026-03-01");
    assert.equal(row.filedOn, "2026-03-25");
    assert.equal(row.dueDate, "2026-04-30");
    let ledger = (await request("/billing", "GET", undefined, attorney!)).body.items.filter((b: any) => b.workflowPublicId === row.publicId);
    assert.equal(ledger.length, 1);
    let bill = ledger[0];
    const data = { kind: "FEE", workDate: bill.workDate, client: marker, matter: marker, description: "Flat prosecution fee", amountCents: 125000, notes: "", code: "OA", jurisdiction: "US", subjectMatter: "", associate: "", shareBasisPoints: 8000, invoiceNumber: "", invoiceDate: null, voided: false, revision: bill.revision };
    assert.equal((await request(`/billing/${bill.publicId}`, "PATCH", data, attorney!)).status, 200);
    const pay = { amountCents: 25000, receivedOn: "2026-04-01", reference: "partial receipt", requestId: randomUUID() };
    assert.equal((await request(`/billing/${bill.publicId}/payments`, "POST", pay, attorney!)).status, 409);
    data.invoiceNumber = "TEST-INV"; data.invoiceDate = "2026-03-31" as any; data.revision++;
    assert.equal((await request(`/billing/${bill.publicId}`, "PATCH", data, attorney!)).status, 200);
    assert.equal((await request(`/rows/${row.publicId}`, "PATCH", { revision: row.revision, filedOn: null }, attorney!)).status, 200, "reopening work preserves its issued invoice");
    assert.equal((await request(`/billing/${bill.publicId}/payments`, "POST", pay, attorney!)).status, 201);
    assert.equal((await request(`/billing/${bill.publicId}/payments`, "POST", pay, attorney!)).status, 201, "receipt retry is idempotent");
    assert.equal((await request(`/billing/${bill.publicId}/payments`, "POST", { ...pay, requestId: randomUUID(), amountCents: 100001 }, attorney!)).status, 409);
    bill = (await request("/billing", "GET", undefined, attorney!)).body.items.find((b: any) => b.publicId === bill.publicId);
    assert.equal(bill.paidCents, 25000);
    assert.equal(bill.payments.length, 1);
    assert.equal((await request(`/billing/${bill.publicId}`, "PATCH", { ...data, revision: bill.revision, amountCents: 130000 }, attorney!)).status, 409);
    const manual = { kind: "REIMBURSEMENT", workDate: "2026-03-26", client: marker, matter: "", description: "Expense recovered by firm", amountCents: 3000, notes: "", code: "", jurisdiction: "", subjectMatter: "", associate: "", shareBasisPoints: 10000 };
    const created = await request("/billing", "POST", manual, attorney!);
    assert.equal(created.status, 201);
    assert.equal((await request(`/billing/${created.body.publicId}/payments`, "POST", { ...pay, requestId: randomUUID(), amountCents: 3000 }, attorney!)).status, 201);
    assert.equal((await request("/billing", "GET", undefined, client!)).status, 403);
    // Pre-billing is independent of completion, even after invoicing and partial payment.
    const preTaskId = `${marker}-prebill`;
    await request("/import", "POST", { ...payload, preview: false, csvText: taskCsv.replace(marker, preTaskId) });
    let preRow = (await request("")).body.rows.find((r: any) => r.title === "Office Action Response" && r.matter === marker && r.publicId !== row.publicId);
    assert.ok(preRow);
    assert.equal((await request(`/rows/${preRow.publicId}`, "PATCH", { revision: preRow.revision, assignedToId: attorney!.id, prebillOn: "2026-02-10" })).status, 200);
    const getPreRow = async () => (await request("", "GET", undefined, attorney!)).body.rows.find((r: any) => r.publicId === preRow.publicId);
    preRow = await getPreRow();
    assert.equal(preRow.filedOn, null, "pre-billed work remains active");
    assert.equal(preRow.prebilledOn, "2026-02-10");
    assert.equal((await request(`/rows/${preRow.publicId}`, "PATCH", { revision: preRow.revision, prebillOn: "2026-02-30" }, attorney!)).status, 400);
    assert.equal((await request(`/rows/${preRow.publicId}`, "PATCH", { revision: preRow.revision, prebillOn: "2026-02-11" }, attorney!)).status, 409);
    // An explicit retry with a fresh revision still keeps the single financial record.
    assert.equal((await request(`/rows/${preRow.publicId}`, "PATCH", { revision: preRow.revision, prebillOn: "2026-02-10" }, attorney!)).status, 200);
    const getPreBill = async () => (await request("/billing", "GET", undefined, attorney!)).body.items.filter((b: any) => b.workflowPublicId === preRow.publicId);
    const before = await getPreBill();
    assert.equal(before.length, 1);
    assert.equal(before[0].completedOn, null);
    const preBill = before[0];
    assert.equal((await request(`/billing/${preBill.publicId}`, "PATCH", { ...data, workDate: preBill.workDate, invoiceNumber: "TEST-PRE", invoiceDate: "2026-02-28", revision: preBill.revision }, attorney!)).status, 200);
    assert.equal((await request(`/billing/${preBill.publicId}/payments`, "POST", { ...pay, receivedOn: "2026-03-01", requestId: randomUUID() }, attorney!)).status, 201);
    preRow = await getPreRow();
    assert.equal((await request(`/rows/${preRow.publicId}`, "PATCH", { revision: preRow.revision, filedOn: "2026-03-25" }, attorney!)).status, 200);
    let after = await getPreBill();
    assert.equal(after.length, 1);
    assert.equal(after[0].publicId, preBill.publicId);
    assert.equal(after[0].prebilledOn, "2026-02-10");
    assert.equal(after[0].workDate, "2026-02-10");
    assert.equal(after[0].invoiceDate, "2026-02-28");
    assert.equal(after[0].completedOn, "2026-03-25");
    assert.equal(after[0].paidCents, 25000);
    // Reopening pre-billed work must not void, uninvoice or delete its existing payment.
    preRow = await getPreRow();
    assert.equal((await request(`/rows/${preRow.publicId}`, "PATCH", { revision: preRow.revision, filedOn: null }, attorney!)).status, 200);
    after = await getPreBill();
    assert.equal(after[0].completedOn, null);
    assert.equal(after[0].voided, false);
    assert.equal(after[0].paidCents, 25000);
    preRow = await getPreRow();
    assert.equal((await request(`/rows/${preRow.publicId}`, "PATCH", { revision: preRow.revision, filedOn: "2026-03-26" }, attorney!)).status, 200);
    assert.equal((await getPreBill()).length, 1);
    // Stages can be skipped, moved backward, or repeated; each occurrence retains its own note/date.
    const setStage = async (status: string, statusDate: string, statusNote: string) => {
      preRow = await getPreRow();
      const result = await request(`/rows/${preRow.publicId}`, "PATCH", { revision: preRow.revision, status, statusDate, statusNote }, attorney!);
      assert.equal(result.status, 200, JSON.stringify(result.body));
    };
    await setStage("Client Review", "2026-04-01", "Review first strategy");
    await setStage("Proofing", "2026-04-02", "First proof");
    await setStage("Drafting", "2026-04-03", "Back to drafting");
    await setStage("Client Review", "2026-04-04", "Review final response");
    await setStage("Client Review", "2026-04-05", "Another review round");
    const events = (await request(`/rows/${preRow.publicId}/history`, "GET", undefined, attorney!)).body.events;
    assert.deepEqual(events.slice(0, 5).map((e: any) => e.status), ["Client Review", "Client Review", "Drafting", "Proofing", "Client Review"]);
    assert.equal(events[0].note, "Another review round");
    assert.equal(events[1].note, "Review final response");
    assert.equal(events[4].note, "Review first strategy");
    assert.equal((await getPreRow()).statusDate, "2026-04-05");
    await setStage("Filed", "2026-04-06", "Filed after repeat reviews");
    assert.equal((await getPreBill()).length, 1);
    assert.equal((await getPreBill())[0].workDate, "2026-02-10");
    assert.equal((await getPreBill())[0].completedOn, "2026-04-06");
    assert.equal((await getPreBill())[0].paidCents, 25000);
    // Unrelated attorneys cannot see this financial record or task.
    const other = await db.insert(portalUsersTable).values({ email: `${marker}-other@example.invalid`, name: `${marker} Other`, role: "ATTORNEY", status: "ACTIVE", active: true, microsoftTenantId: randomUUID(), microsoftObjectId: randomUUID() }).returning();
    users.push(other[0]!);
    assert.equal((await request("", "GET", undefined, other[0]!)).body.rows.some((r: any) => r.publicId === row.publicId), false);
    assert.equal((await request(`/rows/${preRow.publicId}/history`, "GET", undefined, other[0]!)).status, 404);
    // AppColl contributor membership grants task-only access; revocation takes effect on the next request.
    const contributorCsv = taskCsv.replace(marker, `${marker}-prebill`).replace("TaskStatus,ClosedOn", "TaskStatus,ClosedOn,Contributors") + "," + other[0]!.email;
    const contributorImport = await request("/import", "POST", { ...payload, csvText: contributorCsv, preview: false });
    assert.equal(contributorImport.body.applied, true);
    assert.equal((await request("", "GET", undefined, other[0]!)).body.rows.some((r: any) => r.publicId === preRow.publicId), true);
    assert.equal((await request("", "GET", undefined, other[0]!)).body.rows.some((r: any) => r.publicId === row.publicId), false, "sharing a matter is not a task assignment");
    await request("/import", "POST", { ...payload, csvText: taskCsv.replace(marker, `${marker}-prebill`), preview: false });
    assert.equal((await request(`/rows/${preRow.publicId}/history`, "GET", undefined, other[0]!)).status, 404);
    assert.equal((await request(`/billing/${bill.publicId}/payments`, "POST", pay, other[0]!)).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    const ownedBills = await db.select({ id: bills.id }).from(bills).where(inArray(bills.ownerId, users.map((u) => u.id)));
    if (ownedBills.length) {
      await db.delete(payments).where(inArray(payments.billingItemId, ownedBills.map((b) => b.id)));
      await db.delete(bills).where(inArray(bills.id, ownedBills.map((b) => b.id)));
    }
    const taskIds = await db.select({ id: docket.id }).from(docket).where(inArray(docket.externalTaskId, [marker, `${marker}-prebill`]));
    if (taskIds.length) {
      const rowIds = await db.select({ id: rows.id }).from(rows).where(inArray(rows.docketTaskId, taskIds.map((t) => t.id)));
      if (rowIds.length) await db.delete(history).where(inArray(history.workflowRowId, rowIds.map((r) => r.id)));
      if (rowIds.length) await db.delete(bills).where(inArray(bills.workflowRowId, rowIds.map((r) => r.id)));
      await db.delete(rows).where(inArray(rows.docketTaskId, taskIds.map((t) => t.id)));
      await db.delete(docket).where(inArray(docket.externalTaskId, [marker, `${marker}-prebill`]));
    }
    await db.delete(matters).where(eq(matters.docketId, marker));
    await db.delete(portalUsersTable).where(inArray(portalUsersTable.id, users.map((u) => u.id)));
    await pool.end();
  }
});
