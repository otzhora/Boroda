import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { projects, ticketActivities, ticketJiraIssueLinks, ticketProjectLinks, tickets, workContexts } from "../../../db/schema";
import { AppError } from "../../../shared/errors";
import { loadTicketJiraIssueLinks, loadTicketProjectLinks, loadTicketWorkspaces } from "./links";

export async function listTickets(
  app: FastifyInstance,
  filters: {
    status: string[];
    priority: string[];
    projectId: number[];
    q?: string;
    jiraIssue: string[];
    scope: "active" | "archived" | "all";
  }
) {
  const queryFilters =
    filters.scope === "active"
      ? [sql`${tickets.archivedAt} is null`]
      : filters.scope === "archived"
        ? [sql`${tickets.archivedAt} is not null`]
        : [];

  if (filters.status.length) {
    queryFilters.push(inArray(tickets.status, filters.status));
  }

  if (filters.priority.length) {
    queryFilters.push(inArray(tickets.priority, filters.priority));
  }

  if (filters.q) {
    queryFilters.push(
      sql`(
        ${tickets.key} like ${`%${filters.q}%`}
        or
        ${tickets.title} like ${`%${filters.q}%`}
        or
        ${tickets.description} like ${`%${filters.q}%`}
        or exists (
          select 1
          from ticket_jira_issue_links
          where ticket_jira_issue_links.ticket_id = ${tickets.id}
            and (
              ticket_jira_issue_links.issue_key like ${`%${filters.q}%`}
              or ticket_jira_issue_links.issue_summary like ${`%${filters.q}%`}
            )
        )
      )`
    );
  }

  if (filters.jiraIssue.length) {
    const jiraIssueClauses = filters.jiraIssue.map(
      (jiraIssue) => sql`(
        ticket_jira_issue_links.issue_key like ${`%${jiraIssue}%`}
        or ticket_jira_issue_links.issue_summary like ${`%${jiraIssue}%`}
      )`
    );

    queryFilters.push(
      sql`exists (
        select 1
        from ticket_jira_issue_links
        where ticket_jira_issue_links.ticket_id = ${tickets.id}
          and (${sql.join(jiraIssueClauses, sql` or `)})
      )`
    );
  }

  if (filters.projectId.length) {
    const linked = app.db
      .select({ ticketId: ticketProjectLinks.ticketId })
      .from(ticketProjectLinks)
      .where(inArray(ticketProjectLinks.projectId, filters.projectId))
      .all()
      .map((row) => row.ticketId);

    if (!linked.length) {
      return [];
    }

    queryFilters.push(inArray(tickets.id, linked));
  }

  const matchingTickets = app.db
    .select()
    .from(tickets)
    .where(queryFilters.length ? and(...queryFilters) : undefined)
    .orderBy(desc(tickets.updatedAt))
    .all();

  const ids = matchingTickets.map((ticket) => ticket.id);
  const links = ids.length
    ? app.db
        .select({
          ticketId: ticketProjectLinks.ticketId,
          projectId: projects.id,
          projectName: projects.name,
          projectColor: projects.color,
          relationship: ticketProjectLinks.relationship
        })
        .from(ticketProjectLinks)
        .innerJoin(projects, eq(ticketProjectLinks.projectId, projects.id))
        .where(inArray(ticketProjectLinks.ticketId, ids))
        .all()
    : [];
  const jiraIssueLinks = ids.length
    ? app.db
        .select({
          ticketId: ticketJiraIssueLinks.ticketId,
          key: ticketJiraIssueLinks.issueKey,
          summary: ticketJiraIssueLinks.issueSummary
        })
        .from(ticketJiraIssueLinks)
        .where(inArray(ticketJiraIssueLinks.ticketId, ids))
        .all()
    : [];
  const contextCounts = ids.length
    ? app.db
        .select({
          ticketId: workContexts.ticketId,
          count: sql<number>`count(*)`
        })
        .from(workContexts)
        .where(inArray(workContexts.ticketId, ids))
        .groupBy(workContexts.ticketId)
        .all()
    : [];

  return matchingTickets.map((ticket) => ({
    ...ticket,
    contextsCount: contextCounts.find((item) => item.ticketId === ticket.id)?.count ?? 0,
    projectBadges: links
      .filter((link) => link.ticketId === ticket.id)
      .map((link) => ({
        id: link.projectId,
        name: link.projectName,
        color: link.projectColor,
        relationship: link.relationship
      })),
    jiraIssues: jiraIssueLinks
      .filter((issue) => issue.ticketId === ticket.id)
      .map((issue) => ({
        key: issue.key,
        summary: issue.summary
      }))
  }));
}

export async function getTicketOrThrow(app: FastifyInstance, id: number) {
  const ticket = app.db
    .select()
    .from(tickets)
    .where(eq(tickets.id, id))
    .get();

  if (!ticket) {
    throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  }

  const projectLinks = await loadTicketProjectLinks(app, id);
  const jiraIssues = await loadTicketJiraIssueLinks(app, id);
  const relatedWorkspaces = await loadTicketWorkspaces(app, id);

  const relatedWorkContexts = app.db
    .select()
    .from(workContexts)
    .where(eq(workContexts.ticketId, id))
    .orderBy(desc(workContexts.createdAt), desc(workContexts.id))
    .all();

  const activities = app.db
    .select()
    .from(ticketActivities)
    .where(eq(ticketActivities.ticketId, id))
    .orderBy(desc(ticketActivities.createdAt))
    .all();

  return {
    ...ticket,
    projectLinks,
    jiraIssues: jiraIssues.map((issue) => ({
      id: issue.id,
      ticketId: issue.ticketId,
      key: issue.issueKey,
      summary: issue.issueSummary,
      createdAt: issue.createdAt
    })),
    workspaces: relatedWorkspaces,
    workContexts: relatedWorkContexts,
    activities
  };
}
