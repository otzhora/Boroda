import {
  BOARD_STATUS_ORDER,
  PROJECT_FOLDER_KINDS,
  TICKET_PRIORITIES,
  TICKET_PROJECT_RELATIONSHIPS,
  TICKET_TYPES,
  WORK_CONTEXT_TYPES
} from "./constants";

export type TicketStatus = (typeof BOARD_STATUS_ORDER)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketProjectRelationship = (typeof TICKET_PROJECT_RELATIONSHIPS)[number];
export type ProjectFolderKind = (typeof PROJECT_FOLDER_KINDS)[number];
export type WorkContextType = (typeof WORK_CONTEXT_TYPES)[number];

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
  kind: ProjectFolderKind;
  isPrimary: boolean;
  existsOnDisk: boolean;
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
  type: TicketType;
  contextsCount: number;
  updatedAt: string;
  projectBadges: Array<{
    id: number;
    name: string;
    relationship: TicketProjectRelationship;
  }>;
}

export interface BoardColumn {
  status: TicketStatus;
  label: string;
  tickets: BoardTicket[];
}

export interface BoardResponse {
  columns: BoardColumn[];
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

export interface Ticket {
  id: number;
  key: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  projectLinks: TicketProjectLink[];
  workContexts: WorkContext[];
  activities: TicketActivity[];
}
