import { ticketActivities } from "../../../db/schema";
import { nowIso, type DbExecutor } from "./shared";

export function recordActivity(
  db: DbExecutor,
  ticketId: number,
  type: string,
  message: string,
  meta: Record<string, unknown> = {}
) {
  db.insert(ticketActivities).values({
    ticketId,
    type,
    message,
    metaJson: JSON.stringify(meta),
    createdAt: nowIso()
  }).run();
}

function serializeProjectLink(link: { projectId: number; relationship: string }) {
  return `${link.projectId}:${link.relationship}`;
}

function serializeJiraIssueLink(link: { key: string }) {
  return normalizeJiraIssueKey(link.key);
}

export function normalizeJiraIssueKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeJiraIssueSummary(value: string) {
  return value.trim();
}

export function formatJiraIssueLabel(issue: { key: string; summary?: string | null }) {
  const summary = issue.summary?.trim();
  return summary ? `${issue.key} ${summary}` : issue.key;
}

export function recordProjectLinkChanges(
  db: DbExecutor,
  ticketId: number,
  previousLinks: Array<{ projectId: number; relationship: string; project?: { name: string } | null }>,
  nextLinks: Array<{ projectId: number; relationship: string; project?: { name: string } | null }>
) {
  const previousByKey = new Map(previousLinks.map((link) => [serializeProjectLink(link), link]));
  const nextByKey = new Map(nextLinks.map((link) => [serializeProjectLink(link), link]));

  for (const [key, link] of nextByKey) {
    if (!previousByKey.has(key)) {
      const projectName = link.project?.name ?? `Project ${link.projectId}`;
      recordActivity(
        db,
        ticketId,
        "ticket.project_linked",
        `${projectName} linked as ${link.relationship.toLowerCase()}`
      );
    }
  }

  for (const [key, link] of previousByKey) {
    if (!nextByKey.has(key)) {
      const projectName = link.project?.name ?? `Project ${link.projectId}`;
      recordActivity(
        db,
        ticketId,
        "ticket.project_unlinked",
        `${projectName} removed from ticket`
      );
    }
  }
}

export function recordJiraIssueLinkChanges(
  db: DbExecutor,
  ticketId: number,
  previousIssues: Array<{ key: string; summary: string }>,
  nextIssues: Array<{ key: string; summary: string }>
) {
  const previousByKey = new Map(previousIssues.map((issue) => [serializeJiraIssueLink(issue), issue]));
  const nextByKey = new Map(nextIssues.map((issue) => [serializeJiraIssueLink(issue), issue]));

  for (const [key, issue] of nextByKey) {
    if (!previousByKey.has(key)) {
      recordActivity(
        db,
        ticketId,
        "ticket.jira_issue_linked",
        `${formatJiraIssueLabel(issue)} linked from Jira`
      );
    }
  }

  for (const [key, issue] of previousByKey) {
    if (!nextByKey.has(key)) {
      recordActivity(
        db,
        ticketId,
        "ticket.jira_issue_unlinked",
        `${formatJiraIssueLabel(issue)} removed from Jira links`
      );
    }
  }
}
