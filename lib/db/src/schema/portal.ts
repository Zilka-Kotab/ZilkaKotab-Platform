import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const portalRoleEnum = pgEnum("portal_role", ["CLIENT", "ATTORNEY", "ADMIN"]);

export const portalUsersTable = pgTable(
  "portal_users",
  {
    id: serial("id").primaryKey(),
    authProviderId: varchar("auth_provider_id"),
    email: varchar("email", { length: 320 }).notNull(),
    name: text("name").notNull(),
    role: portalRoleEnum("role").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("portal_users_email_unique").on(table.email),
    uniqueIndex("portal_users_auth_provider_unique").on(table.authProviderId),
    index("portal_users_active_role_idx").on(table.active, table.role),
  ],
);

export const clientsTable = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [index("clients_active_idx").on(table.active)],
);

export const clientUsersTable = pgTable(
  "client_users",
  {
    userId: integer("user_id").notNull().references(() => portalUsersTable.id, { onDelete: "cascade" }),
    clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("client_users_unique").on(table.userId, table.clientId)],
);

export const attorneyClientsTable = pgTable(
  "attorney_clients",
  {
    attorneyUserId: integer("attorney_user_id").notNull().references(() => portalUsersTable.id, { onDelete: "cascade" }),
    clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("attorney_clients_unique").on(table.attorneyUserId, table.clientId)],
);

export const toolsTable = pgTable(
  "tools",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("tools_slug_unique").on(table.slug)],
);

export const clientToolsTable = pgTable(
  "client_tools",
  {
    clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    toolId: integer("tool_id").notNull().references(() => toolsTable.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("client_tools_unique").on(table.clientId, table.toolId)],
);

export const projectsTable = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    toolId: integer("tool_id").notNull().references(() => toolsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: varchar("status", { length: 80 }).notNull().default("Active"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("projects_client_tool_idx").on(table.clientId, table.toolId),
    index("projects_active_idx").on(table.active),
  ],
);

export const projectUsersTable = pgTable(
  "project_users",
  {
    userId: integer("user_id").notNull().references(() => portalUsersTable.id, { onDelete: "cascade" }),
    projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("project_users_unique").on(table.userId, table.projectId)],
);

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id").notNull().references(() => portalUsersTable.id),
    action: varchar("action", { length: 120 }).notNull(),
    affectedUserId: integer("affected_user_id"),
    affectedClientId: integer("affected_client_id"),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_created_idx").on(table.createdAt)],
);

export type PortalUser = typeof portalUsersTable.$inferSelect;
export type Client = typeof clientsTable.$inferSelect;
export type Tool = typeof toolsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;