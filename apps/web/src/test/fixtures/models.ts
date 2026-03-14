import type {
  JiraIssueLinkSummary,
  Project,
  Ticket,
  TicketActivity,
  TicketListItem,
  TicketProjectLink,
  TicketWorkspace,
  WorkContext
} from "../../lib/types";

const defaultTimestamp = "2026-03-01T10:00:00.000Z";

export function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "Payments Backend",
    slug: "payments-backend",
    description: "",
    color: "#355c7d",
    createdAt: defaultTimestamp,
    updatedAt: defaultTimestamp,
    archivedAt: null,
    folders: [],
    ...overrides
  };
}

export function createJiraIssueLinkSummary(overrides: Partial<JiraIssueLinkSummary> = {}): JiraIssueLinkSummary {
  return {
    key: "PAY-128",
    summary: "Default Jira issue",
    ...overrides
  };
}

export function createTicketListItem(overrides: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: 12,
    key: "BRD-12",
    title: "Default ticket",
    description: "",
    branch: null,
    status: "INBOX",
    priority: "MEDIUM",
    dueAt: null,
    createdAt: defaultTimestamp,
    updatedAt: defaultTimestamp,
    archivedAt: null,
    contextsCount: 0,
    projectBadges: [],
    jiraIssues: [],
    ...overrides
  };
}

export function createTicketProjectLink(overrides: Partial<TicketProjectLink> = {}): TicketProjectLink {
  const project = overrides.project ?? createProject({ id: overrides.projectId ?? 1 });

  return {
    id: 1,
    ticketId: 12,
    projectId: project.id,
    relationship: "PRIMARY",
    createdAt: defaultTimestamp,
    project,
    ...overrides
  };
}

export function createTicketWorkspace(overrides: Partial<TicketWorkspace> = {}): TicketWorkspace {
  const project = overrides.projectFolder?.project ?? createProject();

  return {
    id: 1,
    ticketId: 12,
    projectFolderId: 1,
    branchName: "feature/default",
    baseBranch: null,
    role: "primary",
    worktreePath: null,
    createdByBoroda: true,
    lastOpenedAt: null,
    createdAt: defaultTimestamp,
    updatedAt: defaultTimestamp,
    projectFolder: {
      id: 1,
      projectId: project.id,
      label: "workspace",
      path: "/tmp/workspace",
      defaultBranch: null,
      kind: "APP",
      isPrimary: true,
      existsOnDisk: true,
      createdAt: defaultTimestamp,
      updatedAt: defaultTimestamp,
      project,
      ...overrides.projectFolder
    },
    ...overrides
  };
}

export function createWorkContext(overrides: Partial<WorkContext> = {}): WorkContext {
  return {
    id: 1,
    ticketId: 7,
    type: "NOTE",
    label: "Context",
    value: "Value",
    metaJson: "{}",
    createdAt: defaultTimestamp,
    updatedAt: defaultTimestamp,
    ...overrides
  };
}

export function createTicketActivity(overrides: Partial<TicketActivity> = {}): TicketActivity {
  return {
    id: 1,
    ticketId: 12,
    type: "ticket.created",
    message: "Created ticket",
    metaJson: "{}",
    createdAt: defaultTimestamp,
    ...overrides
  };
}

export function createTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 12,
    key: "BRD-12",
    title: "Default ticket",
    description: "",
    branch: null,
    workspaces: [],
    status: "INBOX",
    priority: "MEDIUM",
    dueAt: null,
    createdAt: defaultTimestamp,
    updatedAt: defaultTimestamp,
    archivedAt: null,
    projectLinks: [],
    jiraIssues: [],
    workContexts: [],
    activities: [],
    ...overrides
  };
}
