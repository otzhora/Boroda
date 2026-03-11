export type TicketStatus = string;

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
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
