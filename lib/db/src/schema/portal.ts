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
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const portalRoleEnum = pgEnum("portal_role", ["CLIENT", "ATTORNEY", "ADMIN"]);
export const portalUserStatusEnum = pgEnum("portal_user_status", ["PENDING", "ACTIVE", "DEACTIVATED"]);

export const portalUsersTable = pgTable(
  "portal_users",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    authProviderId: varchar("auth_provider_id"),
    microsoftTenantId: varchar("microsoft_tenant_id", { length: 36 }),
    microsoftObjectId: varchar("microsoft_object_id", { length: 36 }),
    email: varchar("email", { length: 320 }).notNull(),
    name: text("name").notNull(),
    role: portalRoleEnum("role").notNull(),
    status: portalUserStatusEnum("status").notNull().default("PENDING"),
    active: boolean("active").notNull().default(true),
    boundAt: timestamp("bound_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("portal_users_public_id_unique").on(table.publicId),
    uniqueIndex("portal_users_email_unique").on(table.email),
    uniqueIndex("portal_users_auth_provider_unique").on(table.authProviderId),
    uniqueIndex("portal_users_microsoft_identity_unique").on(table.microsoftTenantId, table.microsoftObjectId),
    index("portal_users_active_role_idx").on(table.active, table.role),
    index("portal_users_status_role_idx").on(table.status, table.role),
  ],
);

export const clientsTable = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    publicId: uuid("public_id").defaultRandom().notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("clients_public_id_unique").on(table.publicId),
    index("clients_active_idx").on(table.active),
  ],
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
    publicId: uuid("public_id").defaultRandom().notNull(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("tools_public_id_unique").on(table.publicId),
    uniqueIndex("tools_slug_unique").on(table.slug),
  ],
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
    publicId: uuid("public_id").defaultRandom().notNull(),
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
    uniqueIndex("projects_public_id_unique").on(table.publicId),
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