import type { FastifyInstance } from "fastify";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { projects, sequences, ticketJiraIssueLinks, ticketProjectLinks, workContexts } from "../../../db/schema";
import { AppError } from "../../../shared/errors";

export function nowIso() {
  return new Date().toISOString();
}

export type AppDb = FastifyInstance["db"];
type TransactionCallback = Parameters<AppDb["transaction"]>[0];
export type DbTransaction = TransactionCallback extends (tx: infer Tx, ...args: never[]) => unknown ? Tx : never;
export type DbExecutor = AppDb | DbTransaction;

function isSqliteUniqueConstraintError(
  error: unknown,
  constraintTarget: string
): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "SQLITE_CONSTRAINT_UNIQUE" &&
    error.message.includes(constraintTarget)
  );
}

export function rethrowTicketConflict(error: unknown): never {
  if (isSqliteUniqueConstraintError(error, "ticket_project_links.ticket_id, ticket_project_links.project_id")) {
    throw new AppError(409, "TICKET_PROJECT_LINK_CONFLICT", "Project is already linked to this ticket");
  }

  if (
    isSqliteUniqueConstraintError(
      error,
      "ticket_jira_issue_links.ticket_id, ticket_jira_issue_links.issue_key"
    )
  ) {
    throw new AppError(409, "TICKET_JIRA_LINK_CONFLICT", "Jira issue is already linked to this ticket");
  }

  throw error;
}

export function nextTicketKey(db: DbExecutor) {
  const existing = db
    .select()
    .from(sequences)
    .where(eq(sequences.name, "ticket"))
    .get();

  if (!existing) {
    db.insert(sequences).values({ name: "ticket", value: 1 }).run();
    return "BRD-1";
  }

  const nextValue = existing.value + 1;
  db
    .update(sequences)
    .set({ value: nextValue })
    .where(eq(sequences.name, "ticket"))
    .run();
  return `BRD-${nextValue}`;
}

export interface TicketListDecorations {
  contextsCountByTicketId: Map<number, number>;
  projectBadgesByTicketId: Map<
    number,
    Array<{
      id: number;
      name: string;
      color: string;
      relationship: string;
    }>
  >;
  jiraIssuesByTicketId: Map<
    number,
    Array<{
      key: string;
      summary: string;
    }>
  >;
}

export interface TicketListItemRecord {
  id: number;
  key: string;
  title: string;
  description: string;
  branch: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface TicketListResponseMeta {
  jiraIssues: string[];
}

export interface TicketListResponse {
  items: Array<TicketListItemRecord & {
    contextsCount: number;
    projectBadges: Array<{
      id: number;
      name: string;
      color: string;
      relationship: string;
    }>;
    jiraIssues: Array<{
      key: string;
      summary: string;
    }>;
  }>;
  meta: TicketListResponseMeta;
}

export async function loadTicketListDecorations(db: DbExecutor, ticketIds: number[]): Promise<TicketListDecorations> {
  if (!ticketIds.length) {
    return {
      contextsCountByTicketId: new Map(),
      projectBadgesByTicketId: new Map(),
      jiraIssuesByTicketId: new Map()
    };
  }

  const [contextCounts, projectRows, jiraIssueRows] = await Promise.all([
    db
      .select({
        ticketId: workContexts.ticketId,
        count: sql<number>`count(*)`
      })
      .from(workContexts)
      .where(inArray(workContexts.ticketId, ticketIds))
      .groupBy(workContexts.ticketId)
      .all(),
    db
      .select({
        ticketId: ticketProjectLinks.ticketId,
        projectId: projects.id,
        projectName: projects.name,
        projectColor: projects.color,
        relationship: ticketProjectLinks.relationship
      })
      .from(ticketProjectLinks)
      .innerJoin(projects, eq(ticketProjectLinks.projectId, projects.id))
      .where(inArray(ticketProjectLinks.ticketId, ticketIds))
      .orderBy(asc(projects.name), asc(projects.id))
      .all(),
    db
      .select({
        ticketId: ticketJiraIssueLinks.ticketId,
        key: ticketJiraIssueLinks.issueKey,
        summary: ticketJiraIssueLinks.issueSummary
      })
      .from(ticketJiraIssueLinks)
      .where(inArray(ticketJiraIssueLinks.ticketId, ticketIds))
      .orderBy(asc(ticketJiraIssueLinks.issueKey), asc(ticketJiraIssueLinks.id))
      .all()
  ]);

  const contextsCountByTicketId = new Map(contextCounts.map((item) => [item.ticketId, item.count]));
  const projectBadgesByTicketId = new Map<number, TicketListDecorations["projectBadgesByTicketId"] extends Map<number, infer T> ? T : never>();
  const jiraIssuesByTicketId = new Map<number, TicketListDecorations["jiraIssuesByTicketId"] extends Map<number, infer T> ? T : never>();

  for (const row of projectRows) {
    const existing = projectBadgesByTicketId.get(row.ticketId) ?? [];
    existing.push({
      id: row.projectId,
      name: row.projectName,
      color: row.projectColor,
      relationship: row.relationship
    });
    projectBadgesByTicketId.set(row.ticketId, existing);
  }

  for (const row of jiraIssueRows) {
    const existing = jiraIssuesByTicketId.get(row.ticketId) ?? [];
    existing.push({
      key: row.key,
      summary: row.summary
    });
    jiraIssuesByTicketId.set(row.ticketId, existing);
  }

  return {
    contextsCountByTicketId,
    projectBadgesByTicketId,
    jiraIssuesByTicketId
  };
}

export function buildTicketListItems(
  tickets: TicketListItemRecord[],
  decorations: TicketListDecorations
): TicketListResponse["items"] {
  return tickets.map((ticket) => ({
    ...ticket,
    contextsCount: decorations.contextsCountByTicketId.get(ticket.id) ?? 0,
    projectBadges: decorations.projectBadgesByTicketId.get(ticket.id) ?? [],
    jiraIssues: decorations.jiraIssuesByTicketId.get(ticket.id) ?? []
  }));
}

export function buildJiraIssueMeta(
  tickets: TicketListItemRecord[],
  jiraIssuesByTicketId: TicketListDecorations["jiraIssuesByTicketId"]
): TicketListResponseMeta {
  const issueKeys = new Set<string>();

  for (const ticket of tickets) {
    for (const issue of jiraIssuesByTicketId.get(ticket.id) ?? []) {
      issueKeys.add(issue.key);
    }
  }

  return {
    jiraIssues: [...issueKeys].sort((left, right) => left.localeCompare(right))
  };
}

export function buildStatusOrderCaseExpression(statusColumn: unknown, statuses: string[]) {
  if (!statuses.length) {
    return sql<number>`0`;
  }

  const cases = statuses.map((status, index) => sql`when ${statusColumn} = ${status} then ${index}`);
  return sql<number>`case ${sql.join(cases, sql` `)} else ${statuses.length} end`;
}
