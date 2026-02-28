export type TicketStatus =
  | "INBOX"
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "IN_REVIEW"
  | "MANUAL_UI"
  | "DONE";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketType = "TASK" | "BUG" | "CHORE" | "REVIEW" | "MANUAL";
export type ProjectFolderKind = "APP" | "BACKEND" | "TERRAFORM" | "INFRA" | "DOCS" | "OTHER";
export type TicketProjectRelationship = "PRIMARY" | "RELATED" | "DEPENDENCY";
export type WorkContextType =
  | "CODEX_SESSION"
  | "CLAUDE_SESSION"
  | "CURSOR_SESSION"
  | "PR"
  | "AWS_CONSOLE"
  | "TERRAFORM_RUN"
  | "MANUAL_UI"
  | "LINK"
  | "NOTE";

export interface PathInfo {
  path: string;
  resolvedPath: string;
  exists: boolean;
  isDirectory: boolean;
}

