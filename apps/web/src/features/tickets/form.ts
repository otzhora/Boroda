import type { JiraIssueLinkSummary, Ticket, TicketPriority, TicketProjectRelationship, TicketStatus } from "../../lib/types";

export interface TicketProjectLinkFormState {
  projectId: string;
  relationship: TicketProjectRelationship;
}

export interface TicketJiraIssueFormState extends JiraIssueLinkSummary {}

export interface TicketWorkspaceFormState {
  id?: number;
  projectFolderId: string;
  branchName: string;
  baseBranch: string;
  role: string;
}

export interface TicketFormState {
  title: string;
  description: string;
  branch: string;
  workspaces: TicketWorkspaceFormState[];
  jiraIssues: TicketJiraIssueFormState[];
  status: TicketStatus;
  priority: TicketPriority;
  dueAt: string;
  projectLinks: TicketProjectLinkFormState[];
}

export function createEmptyTicketForm(): TicketFormState {
  return {
    title: "",
    description: "",
    branch: "",
    workspaces: [],
    jiraIssues: [],
    status: "INBOX",
    priority: "MEDIUM",
    dueAt: "",
    projectLinks: []
  };
}

export function createProjectLinkRow(): TicketProjectLinkFormState {
  return {
    projectId: "",
    relationship: "RELATED"
  };
}

function toDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toApiDateTime(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toOptionalApiText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length ? trimmedValue : null;
}

function getPreferredProjectFolderId(ticket: Ticket) {
  const sortedLinks = [...ticket.projectLinks].sort((left, right) => {
    if (left.relationship === right.relationship) {
      return left.projectId - right.projectId;
    }

    if (left.relationship === "PRIMARY") {
      return -1;
    }

    if (right.relationship === "PRIMARY") {
      return 1;
    }

    return left.projectId - right.projectId;
  });

  for (const link of sortedLinks) {
    const primaryFolder = link.project.folders.find((folder) => folder.isPrimary);
    if (primaryFolder) {
      return String(primaryFolder.id);
    }

    if (link.project.folders[0]) {
      return String(link.project.folders[0].id);
    }
  }

  return "";
}

function dedupeJiraIssues(jiraIssues: TicketJiraIssueFormState[]) {
  const seenKeys = new Set<string>();

  return jiraIssues.filter((issue) => {
    const key = issue.key.trim().toUpperCase();

    if (!key || seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });
}

export function toTicketForm(ticket: Ticket): TicketFormState {
  const workspaces =
    ticket.workspaces.length > 0
      ? ticket.workspaces.map((workspace) => ({
          id: workspace.id,
          projectFolderId: String(workspace.projectFolderId),
          branchName: workspace.branchName,
          baseBranch: workspace.baseBranch ?? "",
          role: workspace.role
        }))
      : ticket.branch
        ? [
            {
              projectFolderId: getPreferredProjectFolderId(ticket),
              branchName: ticket.branch,
              baseBranch: "",
              role: "primary"
            }
          ]
        : [];

  return {
    title: ticket.title,
    description: ticket.description,
    branch: ticket.branch ?? "",
    workspaces,
    jiraIssues: dedupeJiraIssues(ticket.jiraIssues.map((issue) => ({
      key: issue.key,
      summary: issue.summary
    }))),
    status: ticket.status,
    priority: ticket.priority,
    dueAt: toDateTimeInput(ticket.dueAt),
    projectLinks: ticket.projectLinks.map((link) => ({
      projectId: String(link.projectId),
      relationship: link.relationship
    }))
  };
}

export function toTicketPayload(form: TicketFormState) {
  const workspaces = form.workspaces
    .map((workspace) => ({
      projectFolderId: Number(workspace.projectFolderId),
      branchName: workspace.branchName.trim(),
      baseBranch: toOptionalApiText(workspace.baseBranch),
      role: workspace.role.trim() || "primary"
    }))
    .filter((workspace) => Number.isInteger(workspace.projectFolderId) && workspace.projectFolderId > 0 && workspace.branchName.length > 0);

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    branch: toOptionalApiText(form.branch) ?? (workspaces[0]?.branchName ?? null),
    workspaces,
    jiraIssues: dedupeJiraIssues(form.jiraIssues).map((issue) => ({
      key: issue.key.trim().toUpperCase(),
      summary: issue.summary.trim()
    })),
    status: form.status,
    priority: form.priority,
    dueAt: toApiDateTime(form.dueAt),
    projectLinks: form.projectLinks
      .filter((link) => link.projectId)
      .map((link) => ({
        projectId: Number(link.projectId),
        relationship: link.relationship
      }))
  };
}
