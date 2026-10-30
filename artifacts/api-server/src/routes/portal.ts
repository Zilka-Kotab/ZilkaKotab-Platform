import { Router, type Request } from "express";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  or,
} from "drizzle-orm";
import {
  attorneyClientsTable,
  auditLogsTable,
  clientsTable,
  clientToolsTable,
  clientUsersTable,
  db,
  portalUsersTable,
  projectsTable,
  projectUsersTable,
  toolsTable,
  type PortalUser,
} from "@workspace/db";
import { requireAdmin, requirePortalAccess, resolvePortalUser } from "../middlewares/portalAccess";
import { projectRelations, serializeClient, serializeProject, serializeTool } from "../lib/portal-resources";

const router = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicIdOf = (value: unknown) => typeof value === "string" && UUID.test(value) ? value : "";
const normalizeEmail = (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "";
const text = (value: unknown, fallback = "") => typeof value === "string" ? value.trim() : fallback;
const boolean = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const role = (value: unknown): PortalUser["role"] | null =>
  value === "CLIENT" || value === "ATTORNEY" || value === "PARALEGAL" || value === "ADMIN" ? value : null;
const userStatus = (value: unknown): PortalUser["status"] | null =>
  value === "PENDING" || value === "ACTIVE" || value === "DEACTIVATED" ? value : null;
const publicIds = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.map(publicIdOf).filter(Boolean))] : [];

async function assignments(userId: number, userRole: PortalUser["role"]) {
  if (userRole === "CLIENT") {
    return (await db.select({ clientId: clientUsersTable.clientId }).from(clientUsersTable).where(eq(clientUsersTable.userId, userId))).map((x) => x.clientId);
  }
  if (userRole === "ATTORNEY") {
    return (await db.select({ clientId: attorneyClientsTable.clientId }).from(attorneyClientsTable).where(eq(attorneyClientsTable.attorneyUserId, userId))).map((x) => x.clientId);
  }
  if (userRole === "ADMIN") return (await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.active, true))).map((x) => x.id);
  return [];
}

async function serializeUser(user: PortalUser) {
  const clientIds = await assignments(user.id, user.role);
  const clients = clientIds.length
    ? await db.select({ publicId: clientsTable.publicId }).from(clientsTable).where(inArray(clientsTable.id, clientIds))
    : [];
  const { id: _internalId, ...safeUser } = user;
  return { ...safeUser, publicId: user.publicId, active: user.status === "ACTIVE", clientAssignments: clients.map((client) => client.publicId) };
}

async function canAccessClient(user: PortalUser, clientId: number) {
  if (user.role === "ADMIN") return true;
  if (user.role === "PARALEGAL") return false;
  const table = user.role === "CLIENT" ? clientUsersTable : attorneyClientsTable;
  const userColumn = user.role === "CLIENT" ? clientUsersTable.userId : attorneyClientsTable.attorneyUserId;
  const [match] = await db.select().from(table).where(and(eq(userColumn, user.id), eq(table.clientId, clientId))).limit(1);
  return Boolean(match);
}

async function canAccessProject(user: PortalUser, projectId: number) {
  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, projectId), eq(projectsTable.active, true))).limit(1);
  if (!project || !(await canAccessClient(user, project.clientId))) return null;
  const [enabledTool] = await db.select().from(clientToolsTable).where(and(
    eq(clientToolsTable.clientId, project.clientId),
    eq(clientToolsTable.toolId, project.toolId),
    eq(clientToolsTable.active, true),
  )).limit(1);
  if (!enabledTool) return null;
  if (user.role !== "CLIENT") return project;
  const [permission] = await db.select().from(projectUsersTable).where(and(eq(projectUsersTable.userId, user.id), eq(projectUsersTable.projectId, project.id))).limit(1);
  return permission ? project : null;
}

async function clientEnvironment(user: PortalUser, clientId: number) {
  if (!(await canAccessClient(user, clientId))) return null;
  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, clientId), eq(clientsTable.active, true))).limit(1);
  if (!client) return null;
  const tools = await db
    .select({ id: toolsTable.id, publicId: toolsTable.publicId, name: toolsTable.name, slug: toolsTable.slug, description: toolsTable.description, active: toolsTable.active, createdAt: toolsTable.createdAt, updatedAt: toolsTable.updatedAt })
    .from(clientToolsTable)
    .innerJoin(toolsTable, eq(clientToolsTable.toolId, toolsTable.id))
    .where(and(eq(clientToolsTable.clientId, clientId), eq(clientToolsTable.active, true), eq(toolsTable.active, true)))
    .orderBy(asc(toolsTable.name));
  let projects = await db.select().from(projectsTable).where(and(eq(projectsTable.clientId, clientId), eq(projectsTable.active, true))).orderBy(asc(projectsTable.name));
  if (user.role === "CLIENT" && projects.length) {
    const permitted = await db.select({ projectId: projectUsersTable.projectId }).from(projectUsersTable).where(and(eq(projectUsersTable.userId, user.id), inArray(projectUsersTable.projectId, projects.map((p) => p.id))));
    const allowed = new Set(permitted.map((p) => p.projectId));
    projects = projects.filter((p) => allowed.has(p.id));
  }
  const toolIds = new Set(tools.map((tool) => tool.id));
  const visibleProjects = projects.filter((project) => toolIds.has(project.toolId));
  return {
    client: serializeClient(client),
    tools: await Promise.all(tools.map(serializeTool)),
    projects: await Promise.all(visibleProjects.map(serializeProject)),
  };
}

async function audit(req: Request, action: string, previousValue: unknown, newValue: unknown, affectedUserId?: number, affectedClientId?: number) {
  await db.insert(auditLogsTable).values({
    adminId: req.portalUser!.id,
    action,
    affectedUserId,
    affectedClientId,
    previousValue: previousValue as Record<string, unknown> | null,
    newValue: newValue as Record<string, unknown> | null,
  });
}

function safeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeAuditValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key === "publicId" || key !== "id" && !key.endsWith("Id"))
      .map(([key, item]) => [key, safeAuditValue(item)]),
  );
}

router.get("/portal/access", async (req, res) => {
  if (!req.isAuthenticated()) return void res.status(401).json({ error: "Authentication required." });
  const user = await resolvePortalUser(req);
  if (!user) return void res.status(403).json({ error: "Access Not Authorized" });
  res.json({ user: await serializeUser(user) });
});

router.use("/portal", requirePortalAccess);

router.get("/portal/dashboard", async (req, res) => {
  const clientIds = await assignments(req.portalUser!.id, req.portalUser!.role);
  const clients = clientIds.length ? await db.select().from(clientsTable).where(and(inArray(clientsTable.id, clientIds), eq(clientsTable.active, true))).orderBy(asc(clientsTable.name)) : [];
  const environments = await Promise.all(clients.map((client) => clientEnvironment(req.portalUser!, client.id)));
  const tools = [...new Map(environments.flatMap((env) => env?.tools ?? []).map((item) => [item.publicId, item])).values()];
  const projects = environments.flatMap((env) => env?.projects ?? []);
  res.json({ clients: req.portalUser!.role === "CLIENT" ? undefined : clients.map(serializeClient), tools, projects });
});

router.get("/portal/clients", async (req, res) => {
  const clientIds = await assignments(req.portalUser!.id, req.portalUser!.role);
  const clients = clientIds.length ? await db.select().from(clientsTable).where(and(inArray(clientsTable.id, clientIds), eq(clientsTable.active, true))).orderBy(asc(clientsTable.name)) : [];
  res.json({ clients: clients.map(serializeClient) });
});

router.get("/portal/clients/:id", async (req, res) => {
  const publicId = publicIdOf(req.params.id);
  const [client] = publicId ? await db.select().from(clientsTable).where(and(eq(clientsTable.publicId, publicId), eq(clientsTable.active, true))).limit(1) : [];
  const environment = client ? await clientEnvironment(req.portalUser!, client.id) : null;
  if (!environment) return void res.status(404).json({ error: "Client not found." });
  res.json(environment);
});

router.get("/portal/tools", async (req, res) => {
  if (req.portalUser!.role === "ADMIN") {
    const tools = await db.select().from(toolsTable).orderBy(asc(toolsTable.name));
    return void res.json({ tools: tools.map(serializeTool) });
  }
  const clientIds = await assignments(req.portalUser!.id, req.portalUser!.role);
  if (!clientIds.length) return void res.json({ tools: [] });
  const tools = await db.selectDistinct({
    id: toolsTable.id, publicId: toolsTable.publicId, name: toolsTable.name, slug: toolsTable.slug, description: toolsTable.description,
    active: toolsTable.active, createdAt: toolsTable.createdAt, updatedAt: toolsTable.updatedAt,
  }).from(clientToolsTable).innerJoin(toolsTable, eq(clientToolsTable.toolId, toolsTable.id)).where(and(
    inArray(clientToolsTable.clientId, clientIds), eq(clientToolsTable.active, true), eq(toolsTable.active, true),
  )).orderBy(asc(toolsTable.name));
  res.json({ tools: await Promise.all(tools.map(serializeTool)) });
});

router.get("/portal/tools/:slug", async (req, res) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [tool] = await db.select().from(toolsTable).where(and(eq(toolsTable.slug, slug), eq(toolsTable.active, true))).limit(1);
  if (!tool) return void res.status(404).json({ error: "Tool not found." });
  const clientIds = await assignments(req.portalUser!.id, req.portalUser!.role);
  if (!clientIds.length && req.portalUser!.role !== "ADMIN") return void res.status(404).json({ error: "Tool not found." });
  const enabledClients = await db.select({ clientId: clientToolsTable.clientId }).from(clientToolsTable).where(and(
    eq(clientToolsTable.toolId, tool.id), inArray(clientToolsTable.clientId, clientIds), eq(clientToolsTable.active, true),
  ));
  const enabledIds = enabledClients.map((x) => x.clientId);
  if (!enabledIds.length && req.portalUser!.role !== "ADMIN") return void res.status(404).json({ error: "Tool not found." });
  let projects = await db.select().from(projectsTable).where(and(eq(projectsTable.toolId, tool.id), inArray(projectsTable.clientId, enabledIds), eq(projectsTable.active, true)));
  if (req.portalUser!.role === "CLIENT" && projects.length) {
    const allowed = await db.select({ projectId: projectUsersTable.projectId }).from(projectUsersTable).where(and(eq(projectUsersTable.userId, req.portalUser!.id), inArray(projectUsersTable.projectId, projects.map((p) => p.id))));
    const allowedIds = new Set(allowed.map((p) => p.projectId));
    projects = projects.filter((p) => allowedIds.has(p.id));
  }
  const clients = enabledIds.length
    ? await db.select().from(clientsTable).where(and(inArray(clientsTable.id, enabledIds), eq(clientsTable.active, true))).orderBy(asc(clientsTable.name))
    : [];
  res.json({
    tool: serializeTool(tool),
    clients: clients.map(serializeClient),
    projects: await Promise.all(projects.map(serializeProject)),
  });
});

router.get("/portal/projects/:id", async (req, res) => {
  const publicId = publicIdOf(req.params.id);
  const [projectRecord] = publicId
    ? await db.select().from(projectsTable).where(and(eq(projectsTable.publicId, publicId), eq(projectsTable.active, true))).limit(1)
    : [];
  const project = projectRecord ? await canAccessProject(req.portalUser!, projectRecord.id) : null;
  if (!project) return void res.status(404).json({ error: "Project not found." });
  const { client, tool } = await projectRelations(project);
  res.json({ project: await serializeProject(project), tool: serializeTool(tool), client: serializeClient(client) });
});

router.use("/portal/admin", requireAdmin);

router.get("/portal/admin/users", async (_req, res) => {
  const users = await db.select().from(portalUsersTable).orderBy(asc(portalUsersTable.email));
  res.json({ users: await Promise.all(users.map(serializeUser)) });
});

router.post("/portal/admin/users", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const nextRole = role(req.body?.role);
  const name = text(req.body?.name);
  if (!EMAIL.test(email) || !nextRole || !name) return void res.status(400).json({ error: "Name, valid email, and role are required." });
  const status = userStatus(req.body?.status) ?? "PENDING";
  const [created] = await db.insert(portalUsersTable).values({
    email,
    name,
    role: nextRole,
    status,
    active: status === "ACTIVE",
  }).onConflictDoNothing({ target: portalUsersTable.email }).returning();
  if (!created) return void res.status(409).json({ error: "A user with this email already exists. Manage their access in Admin instead." });
  await replaceAssignments(created.id, created.role, publicIds(req.body?.clientAssignments));
  await replaceProjects(created.id, publicIds(req.body?.projectIds));
  await audit(req, "USER_CREATED", null, created, created.id);
  res.status(201).json({ user: await serializeUser(created) });
});

router.patch("/portal/admin/users/:id", async (req, res) => {
  const publicId = publicIdOf(req.params.id);
  const [current] = publicId ? await db.select().from(portalUsersTable).where(eq(portalUsersTable.publicId, publicId)).limit(1) : [];
  if (!current) return void res.status(404).json({ error: "User not found." });
  const id = current.id;
  const nextRole = role(req.body?.role) ?? current.role;
  const requestedStatus = userStatus(req.body?.status);
  const legacyStatus = typeof req.body?.active === "boolean" ? (req.body.active ? "ACTIVE" : "DEACTIVATED") : null;
  const status = requestedStatus ?? legacyStatus ?? current.status;
  if (current.id === req.portalUser!.id && (status !== "ACTIVE" || nextRole !== "ADMIN")) return void res.status(400).json({ error: "You cannot remove your own administrator access." });
  const nextEmail = req.body?.email === undefined ? current.email : normalizeEmail(req.body.email);
  if (!EMAIL.test(nextEmail)) return void res.status(400).json({ error: "A valid email is required." });
  const emailChanged = nextEmail !== current.email;
  const [updated] = await db.update(portalUsersTable).set({
    email: nextEmail,
    name: req.body?.name === undefined ? current.name : text(req.body.name, current.name),
    role: nextRole,
    status: emailChanged ? "PENDING" : status,
    active: emailChanged ? false : status === "ACTIVE",
    ...(emailChanged ? {
      microsoftTenantId: null,
      microsoftObjectId: null,
      boundAt: null,
    } : {}),
    updatedAt: new Date(),
  }).where(eq(portalUsersTable.id, id)).returning();
  if (Array.isArray(req.body?.clientAssignments) || nextRole !== current.role) await replaceAssignments(id, nextRole, publicIds(req.body?.clientAssignments));
  if (Array.isArray(req.body?.projectIds)) await replaceProjects(id, publicIds(req.body.projectIds));
  await audit(req, "USER_UPDATED", current, updated, id);
  res.json({ user: await serializeUser(updated) });
});

async function replaceAssignments(userId: number, userRole: PortalUser["role"], clientPublicIds: string[]) {
  const clients = clientPublicIds.length
    ? await db.select({ id: clientsTable.id }).from(clientsTable).where(inArray(clientsTable.publicId, clientPublicIds))
    : [];
  const clientIds = clients.map((client) => client.id);
  await db.transaction(async (tx) => {
    await tx.delete(clientUsersTable).where(eq(clientUsersTable.userId, userId));
    await tx.delete(attorneyClientsTable).where(eq(attorneyClientsTable.attorneyUserId, userId));
    if (userRole === "CLIENT" && clientIds.length) await tx.insert(clientUsersTable).values(clientIds.map((clientId) => ({ userId, clientId })));
    if (userRole === "ATTORNEY" && clientIds.length) await tx.insert(attorneyClientsTable).values(clientIds.map((clientId) => ({ attorneyUserId: userId, clientId })));
  });
}

async function replaceProjects(userId: number, projectPublicIds: string[]) {
  const projects = projectPublicIds.length
    ? await db.select({ id: projectsTable.id }).from(projectsTable).where(inArray(projectsTable.publicId, projectPublicIds))
    : [];
  const projectIds = projects.map((project) => project.id);
  await db.transaction(async (tx) => {
    await tx.delete(projectUsersTable).where(eq(projectUsersTable.userId, userId));
    if (projectIds.length) await tx.insert(projectUsersTable).values(projectIds.map((projectId) => ({ userId, projectId })));
  });
}

router.get("/portal/admin/clients", async (_req, res) => {
  const clients = await db.select().from(clientsTable).orderBy(asc(clientsTable.name));
  res.json({ clients: clients.map(serializeClient) });
});
router.post("/portal/admin/clients", async (req, res) => {
  const name = text(req.body?.name);
  if (!name) return void res.status(400).json({ error: "Client name is required." });
  const [client] = await db.insert(clientsTable).values({ name, active: boolean(req.body?.active, true) }).returning();
  await audit(req, "CLIENT_CREATED", null, client, undefined, client.id);
  res.status(201).json({ client: serializeClient(client) });
});
router.patch("/portal/admin/clients/:id", async (req, res) => {
  const publicId = publicIdOf(req.params.id);
  const [current] = publicId ? await db.select().from(clientsTable).where(eq(clientsTable.publicId, publicId)).limit(1) : [];
  if (!current) return void res.status(404).json({ error: "Client not found." });
  const [client] = await db.update(clientsTable).set({
    name: req.body?.name === undefined ? current.name : text(req.body.name, current.name),
    active: boolean(req.body?.active, current.active),
    updatedAt: new Date(),
  }).where(eq(clientsTable.id, current.id)).returning();
  await audit(req, "CLIENT_UPDATED", current, client, undefined, current.id);
  res.json({ client: serializeClient(client) });
});

router.get("/portal/admin/tools", async (_req, res) => {
  const tools = await db.select().from(toolsTable).orderBy(asc(toolsTable.name));
  res.json({ tools: tools.map(serializeTool) });
});
router.get("/portal/admin/tool-access", async (_req, res) => {
  const rows = await db
    .select({
      toolId: toolsTable.publicId,
      clientId: clientsTable.publicId,
      clientName: clientsTable.name,
    })
    .from(clientToolsTable)
    .innerJoin(clientsTable, eq(clientToolsTable.clientId, clientsTable.id))
    .innerJoin(toolsTable, eq(clientToolsTable.toolId, toolsTable.id))
    .where(eq(clientToolsTable.active, true))
    .orderBy(asc(clientsTable.name));
  res.json({ access: rows });
});
router.get("/portal/admin/client-tools", async (_req, res) => {
  const rows = await db
    .select({ clientId: clientsTable.publicId, toolId: toolsTable.publicId })
    .from(clientToolsTable)
    .innerJoin(clientsTable, eq(clientToolsTable.clientId, clientsTable.id))
    .innerJoin(toolsTable, eq(clientToolsTable.toolId, toolsTable.id))
    .where(eq(clientToolsTable.active, true));
  res.json({ assignments: rows });
});
router.post("/portal/admin/tools", async (req, res) => {
  const name = text(req.body?.name);
  const slug = text(req.body?.slug).toLowerCase();
  if (!name || !SLUG.test(slug)) return void res.status(400).json({ error: "Tool name and a valid slug are required." });
  const [tool] = await db.insert(toolsTable).values({ name, slug, description: text(req.body?.description), active: boolean(req.body?.active, true) }).returning();
  await audit(req, "TOOL_CREATED", null, tool);
  res.status(201).json({ tool: serializeTool(tool) });
});
router.patch("/portal/admin/tools/:id", async (req, res) => {
  const publicId = publicIdOf(req.params.id);
  const [current] = publicId ? await db.select().from(toolsTable).where(eq(toolsTable.publicId, publicId)).limit(1) : [];
  if (!current) return void res.status(404).json({ error: "Tool not found." });
  const slug = req.body?.slug === undefined ? current.slug : text(req.body.slug).toLowerCase();
  if (!SLUG.test(slug)) return void res.status(400).json({ error: "A valid slug is required." });
  const [tool] = await db.update(toolsTable).set({
    name: req.body?.name === undefined ? current.name : text(req.body.name, current.name),
    slug,
    description: req.body?.description === undefined ? current.description : text(req.body.description),
    active: boolean(req.body?.active, current.active),
    updatedAt: new Date(),
  }).where(eq(toolsTable.id, current.id)).returning();
  await audit(req, "TOOL_UPDATED", current, tool);
  res.json({ tool: serializeTool(tool) });
});

router.put("/portal/admin/clients/:id/tools", async (req, res) => {
  const clientPublicId = publicIdOf(req.params.id);
  const [client] = clientPublicId ? await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.publicId, clientPublicId)).limit(1) : [];
  const toolPublicIds = publicIds(req.body?.toolIds);
  const tools = toolPublicIds.length
    ? await db.select({ id: toolsTable.id }).from(toolsTable).where(inArray(toolsTable.publicId, toolPublicIds))
    : [];
  if (!client) return void res.status(404).json({ error: "Client not found." });
  const clientId = client.id;
  const toolIds = tools.map((tool) => tool.id);
  await db.transaction(async (tx) => {
    await tx.delete(clientToolsTable).where(eq(clientToolsTable.clientId, clientId));
    if (toolIds.length) await tx.insert(clientToolsTable).values(toolIds.map((toolId) => ({ clientId, toolId, active: true })));
  });
  await audit(req, "CLIENT_TOOLS_REPLACED", null, { toolIds }, undefined, clientId);
  res.json({ success: true });
});

router.post("/portal/admin/projects", async (req, res) => {
  const clientPublicId = publicIdOf(req.body?.clientId);
  const toolPublicId = publicIdOf(req.body?.toolId);
  const name = text(req.body?.name);
  if (!clientPublicId || !toolPublicId || !name) return void res.status(400).json({ error: "Client, tool, and project name are required." });
  const [client, tool] = await Promise.all([
    db.select().from(clientsTable).where(and(eq(clientsTable.publicId, clientPublicId), eq(clientsTable.active, true))).limit(1),
    db.select().from(toolsTable).where(and(eq(toolsTable.publicId, toolPublicId), eq(toolsTable.active, true))).limit(1),
  ]);
  if (!client.length) return void res.status(400).json({ error: "The selected client is not active or does not exist." });
  if (!tool.length) return void res.status(400).json({ error: "The selected tool is not active or does not exist." });
  const clientId = client[0].id;
  const toolId = tool[0].id;
  const [project] = await db.transaction(async (tx) => {
    await tx.insert(clientToolsTable).values({
      clientId,
      toolId,
      active: true,
    }).onConflictDoUpdate({
      target: [clientToolsTable.clientId, clientToolsTable.toolId],
      set: { active: true },
    });
    return tx.insert(projectsTable).values({
      clientId, toolId, name, description: text(req.body?.description), status: text(req.body?.status, "Active"), active: boolean(req.body?.active, true),
    }).returning();
  });
  await audit(req, "PROJECT_CREATED", null, project, undefined, clientId);
  res.status(201).json({ project: await serializeProject(project) });
});
router.get("/portal/admin/projects", async (_req, res) => {
  const projects = await db.select().from(projectsTable).orderBy(asc(projectsTable.name));
  res.json({ projects: await Promise.all(projects.map(serializeProject)) });
});
router.patch("/portal/admin/projects/:id", async (req, res) => {
  const publicId = publicIdOf(req.params.id);
  const [current] = publicId ? await db.select().from(projectsTable).where(eq(projectsTable.publicId, publicId)).limit(1) : [];
  if (!current) return void res.status(404).json({ error: "Project not found." });
  const [project] = await db.update(projectsTable).set({
    name: req.body?.name === undefined ? current.name : text(req.body.name, current.name),
    description: req.body?.description === undefined ? current.description : text(req.body.description),
    status: req.body?.status === undefined ? current.status : text(req.body.status, current.status),
    active: boolean(req.body?.active, current.active),
    updatedAt: new Date(),
  }).where(eq(projectsTable.id, current.id)).returning();
  await audit(req, "PROJECT_UPDATED", current, project, undefined, current.clientId);
  res.json({ project: await serializeProject(project) });
});

router.get("/portal/admin/audit", async (_req, res) => {
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(250);
  res.json({
    logs: logs.map((log) => ({
      action: log.action,
      previousValue: log.previousValue ? JSON.stringify(safeAuditValue(log.previousValue)) : undefined,
      newValue: log.newValue ? JSON.stringify(safeAuditValue(log.newValue)) : undefined,
      createdAt: log.createdAt,
    })),
  });
});

export default router;