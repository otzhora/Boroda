export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

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

export const VISIBLE_WORK_CONTEXT_TYPES = ["PR", "AWS_CONSOLE", "TERRAFORM_RUN", "LINK", "NOTE"] as const;

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

export function formatStatusLabel(status: string) {
  return status
    .trim()
    .split(/_+/)
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
