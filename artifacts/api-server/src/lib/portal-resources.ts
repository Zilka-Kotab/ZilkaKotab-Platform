import {
  clientsTable,
  db,
  projectsTable,
  toolsTable,
  type Client,
  type Project,
  type Tool,
} from "@workspace/db";
import { eq } from "drizzle-orm";

export function serializeClient(client: Client) {
  return {
    publicId: client.publicId,
    name: client.name,
    active: client.active,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

export function serializeTool(tool: Tool) {
  return {
    publicId: tool.publicId,
    name: tool.name,
    slug: tool.slug,
    description: tool.description,
    active: tool.active,
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt,
  };
}

export async function projectRelations(project: Project) {
  const [[client], [tool]] = await Promise.all([
    db.select().from(clientsTable).where(eq(clientsTable.id, project.clientId)).limit(1),
    db.select().from(toolsTable).where(eq(toolsTable.id, project.toolId)).limit(1),
  ]);
  if (!client || !tool) throw new Error("Project references missing client or tool.");
  return { client, tool };
}

export async function serializeProject(project: Project) {
  const { client, tool } = await projectRelations(project);
  return {
    publicId: project.publicId,
    clientId: client.publicId,
    toolId: tool.publicId,
    name: project.name,
    description: project.description,
    status: project.status,
    active: project.active,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}