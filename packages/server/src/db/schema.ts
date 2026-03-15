import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sequences = sqliteTable("sequences", {
  name: text("name").primaryKey(),
  value: integer("value").notNull().default(0)
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  archivedAt: text("archived_at")
});

export const projectFolders = sqliteTable(
  "project_folders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    path: text("path").notNull().unique(),
    defaultBranch: text("default_branch"),
    kind: text("kind").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    existsOnDisk: integer("exists_on_disk", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("idx_project_folders_project_id").on(table.projectId)]
);

export const boardColumns = sqliteTable(
  "board_columns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    status: text("status").notNull().unique(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [uniqueIndex("board_columns_position_unique").on(table.position)]
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    branch: text("branch"),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    dueAt: text("due_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    archivedAt: text("archived_at")
  },
  (table) => [
    index("idx_tickets_status_priority_updated").on(
      table.status,
      table.priority,
      table.updatedAt
    )
  ]
);

export const ticketProjectLinks = sqliteTable(
  "ticket_project_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index("idx_ticket_project_links_ticket_id").on(table.ticketId),
    index("idx_ticket_project_links_project_id").on(table.projectId),
    uniqueIndex("ticket_project_unique").on(table.ticketId, table.projectId)
  ]
);

export const ticketWorkspaces = sqliteTable(
  "ticket_workspaces",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    projectFolderId: integer("project_folder_id")
      .notNull()
      .references(() => projectFolders.id, { onDelete: "cascade" }),
    branchName: text("branch_name").notNull(),
    baseBranch: text("base_branch"),
    role: text("role").notNull().default("primary"),
    worktreePath: text("worktree_path"),
    createdByBoroda: integer("created_by_boroda", { mode: "boolean" }).notNull().default(true),
    lastOpenedAt: text("last_opened_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index("idx_ticket_workspaces_ticket_id").on(table.ticketId),
    index("idx_ticket_workspaces_project_folder_id").on(table.projectFolderId),
    uniqueIndex("ticket_workspace_unique").on(
      table.ticketId,
      table.projectFolderId,
      table.branchName
    )
  ]
);

export const ticketJiraIssueLinks = sqliteTable(
  "ticket_jira_issue_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    issueKey: text("issue_key").notNull(),
    issueSummary: text("issue_summary").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index("idx_ticket_jira_issue_links_ticket_id").on(table.ticketId),
    index("idx_ticket_jira_issue_links_issue_key").on(table.issueKey),
    uniqueIndex("ticket_jira_issue_unique").on(table.ticketId, table.issueKey)
  ]
);

export const workContexts = sqliteTable(
  "work_contexts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    metaJson: text("meta_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("idx_work_contexts_ticket_id").on(table.ticketId)]
);

export const ticketActivities = sqliteTable("ticket_activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  metaJson: text("meta_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});

export const jiraSettings = sqliteTable(
  "jira_settings",
  {
    id: integer("id").primaryKey().notNull().default(1),
    baseUrl: text("base_url").notNull(),
    email: text("email").notNull(),
    apiToken: text("api_token").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [check("jira_settings_singleton", sql`${table.id} = 1`)]
);

export const projectRelations = relations(projects, ({ many }) => ({
  folders: many(projectFolders),
  ticketLinks: many(ticketProjectLinks)
}));

export const projectFolderRelations = relations(projectFolders, ({ one }) => ({
  project: one(projects, {
    fields: [projectFolders.projectId],
    references: [projects.id]
  })
}));

export const ticketRelations = relations(tickets, ({ many }) => ({
  projectLinks: many(ticketProjectLinks),
  workspaces: many(ticketWorkspaces),
  jiraIssueLinks: many(ticketJiraIssueLinks),
  workContexts: many(workContexts),
  activities: many(ticketActivities)
}));

export const ticketProjectLinkRelations = relations(ticketProjectLinks, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketProjectLinks.ticketId],
    references: [tickets.id]
  }),
  project: one(projects, {
    fields: [ticketProjectLinks.projectId],
    references: [projects.id]
  })
}));

export const ticketJiraIssueLinkRelations = relations(ticketJiraIssueLinks, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketJiraIssueLinks.ticketId],
    references: [tickets.id]
  })
}));

export const ticketWorkspaceRelations = relations(ticketWorkspaces, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketWorkspaces.ticketId],
    references: [tickets.id]
  }),
  projectFolder: one(projectFolders, {
    fields: [ticketWorkspaces.projectFolderId],
    references: [projectFolders.id]
  })
}));

export const workContextRelations = relations(workContexts, ({ one }) => ({
  ticket: one(tickets, {
    fields: [workContexts.ticketId],
    references: [tickets.id]
  })
}));

export const ticketActivityRelations = relations(ticketActivities, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketActivities.ticketId],
    references: [tickets.id]
  })
}));
