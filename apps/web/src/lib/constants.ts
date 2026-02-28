export const BOARD_STATUS_ORDER = [
  "INBOX",
  "READY",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "MANUAL_UI",
  "DONE"
] as const;

export const statusLabelMap: Record<(typeof BOARD_STATUS_ORDER)[number], string> = {
  INBOX: "Inbox",
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In Review",
  MANUAL_UI: "Manual UI",
  DONE: "Done"
};

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const TICKET_TYPES = ["TASK", "BUG", "CHORE", "REVIEW", "MANUAL"] as const;

export const TICKET_PROJECT_RELATIONSHIPS = ["PRIMARY", "RELATED", "DEPENDENCY"] as const;

export const PROJECT_FOLDER_KINDS = [
  "APP",
  "BACKEND",
  "TERRAFORM",
  "INFRA",
  "DOCS",
  "OTHER"
] as const;

export const WORK_CONTEXT_TYPES = [
  "CODEX_SESSION",
  "CLAUDE_SESSION",
  "CURSOR_SESSION",
  "PR",
  "AWS_CONSOLE",
  "TERRAFORM_RUN",
  "MANUAL_UI",
  "LINK",
  "NOTE"
] as const;

export const workContextTypeLabelMap: Record<(typeof WORK_CONTEXT_TYPES)[number], string> = {
  CODEX_SESSION: "Codex session",
  CLAUDE_SESSION: "Claude session",
  CURSOR_SESSION: "Cursor session",
  PR: "Pull request",
  AWS_CONSOLE: "AWS console",
  TERRAFORM_RUN: "Terraform run",
  MANUAL_UI: "Manual UI",
  LINK: "Link",
  NOTE: "Note"
};
