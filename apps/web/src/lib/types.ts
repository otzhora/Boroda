import { PROJECT_FOLDER_KINDS, TICKET_PRIORITIES, TICKET_PROJECT_RELATIONSHIPS, WORK_CONTEXT_TYPES } from "./constants";

export type TicketStatus = string;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketProjectRelationship = (typeof TICKET_PROJECT_RELATIONSHIPS)[number];
export type ProjectFolderKind = (typeof PROJECT_FOLDER_KINDS)[number];
export type WorkContextType = (typeof WORK_CONTEXT_TYPES)[number];
export type OpenInTarget = "explorer" | "vscode" | "cursor" | "terminal";
export type OpenInMode = "folder" | "worktree";

export interface PathInfo {
  path: string;
  resolvedPath: string;
  exists: boolean;
  isDirectory: boolean;
}

export interface ProjectFolder {
  id: number;
  projectId: number;
  label: string;
  path: string;
  defaultBranch: string | null;
  kind: ProjectFolderKind;
  isPrimary: boolean;
  existsOnDisk: boolean;
  setupInfo?: {
    hasWorktreeSetup: boolean;
    configPath: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  folders: ProjectFolder[];
}

export interface ProjectFolderWithPathInfo extends ProjectFolder {
  pathInfo: PathInfo | null;
}

export interface BoardTicket {
  id: number;
  key: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  contextsCount: number;
  updatedAt: string;
  projectBadges: Array<{
    id: number;
    name: string;
    color: string;
    relationship: TicketProjectRelationship;
  }>;
  jiraIssues: JiraIssueLinkSummary[];
}

export interface BoardColumn {
  status: TicketStatus;
  label: string;
  tickets: BoardTicket[];
}

export interface BoardColumnDefinition {
  id: number;
  status: string;
  label: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardResponse {
  columns: BoardColumn[];
}

export interface BoardColumnsResponse {
  columns: BoardColumnDefinition[];
}

export interface TicketProjectLink {
  id: number;
  ticketId: number;
  projectId: number;
  relationship: TicketProjectRelationship;
  createdAt: string;
  project: Project;
}

export interface TicketActivity {
  id: number;
  ticketId: number;
  type: string;
  message: string;
  metaJson: string;
  createdAt: string;
}

export interface WorkContext {
  id: number;
  ticketId: number;
  type: WorkContextType;
  label: string;
  value: string;
  metaJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface JiraIssueLinkSummary {
  key: string;
  summary: string;
}

export interface TicketJiraIssueLink extends JiraIssueLinkSummary {
  id: number;
  ticketId: number;
  createdAt: string;
}

export interface Ticket {
  id: number;
  key: string;
  title: string;
  description: string;
  branch: string | null;
  workspaces: TicketWorkspace[];
  status: TicketStatus;
  priority: TicketPriority;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  projectLinks: TicketProjectLink[];
  jiraIssues: TicketJiraIssueLink[];
  workContexts: WorkContext[];
  activities: TicketActivity[];
}

export interface TicketListItem {
  id: number;
  key: string;
  title: string;
  description: string;
  branch: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  contextsCount: number;
  projectBadges: Array<{
    id: number;
    name: string;
    color: string;
    relationship: TicketProjectRelationship;
  }>;
  jiraIssues: JiraIssueLinkSummary[];
}

export interface TicketListResponse {
  items: TicketListItem[];
  meta: {
    jiraIssues: string[];
  };
}

export interface TicketWorkspace {
  id: number;
  ticketId: number;
  projectFolderId: number;
  branchName: string;
  baseBranch: string | null;
  role: string;
  worktreePath: string | null;
  createdByBoroda: boolean;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  projectFolder: ProjectFolder & {
    project: Pick<Project, "id" | "name" | "slug" | "color" | "description" | "createdAt" | "updatedAt">;
  };
}
