import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { projects, ticketActivities, ticketJiraIssueLinks, ticketProjectLinks, tickets, workContexts } from "../../../db/schema";
import { AppError } from "../../../shared/errors";
import { ensureBoardColumnsPresent } from "../../board/columns";
import { loadTicketJiraIssueLinks, loadTicketProjectLinks, loadTicketWorkspaces } from "./links";
import {
  buildJiraIssueMeta,
  buildStatusOrderCaseExpression,
  buildTicketListItems,
  loadTicketListDecorations,
  type TicketListItemRecord
} from "./shared";

export async function listTickets(
  app: FastifyInstance,
  filters: {
    status: string[];
    priority: string[];
    projectId: number[];
    q?: string;
    jiraIssue: string[];
    scope: "active" | "archived" | "all";
    sort: "ticket" | "jira" | "status" | "priority" | "projects" | "updated";
    dir: "asc" | "desc";
  }
) {
  const baseQueryFilters =
    filters.scope === "active"
      ? [sql`${tickets.archivedAt} is null`]
      : filters.scope === "archived"
        ? [sql`${tickets.archivedAt} is not null`]
        : [];

  if (filters.status.length) {
    baseQueryFilters.push(inArray(tickets.status, filters.status));
  }

  if (filters.priority.length) {
    baseQueryFilters.push(inArray(tickets.priority, filters.priority));
  }

  if (filters.q) {
    baseQueryFilters.push(
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

  let jiraIssueFilter: ReturnType<typeof sql> | undefined;

  if (filters.jiraIssue.length) {
    const jiraIssueClauses = filters.jiraIssue.map(
      (jiraIssue) => sql`(
        ticket_jira_issue_links.issue_key like ${`%${jiraIssue}%`}
        or ticket_jira_issue_links.issue_summary like ${`%${jiraIssue}%`}
      )`
    );

    jiraIssueFilter = sql`exists (
      select 1
      from ticket_jira_issue_links
      where ticket_jira_issue_links.ticket_id = ${tickets.id}
        and (${sql.join(jiraIssueClauses, sql` or `)})
    )`;
    baseQueryFilters.push(jiraIssueFilter);
  }

  if (filters.projectId.length) {
    const linked = app.db
      .select({ ticketId: ticketProjectLinks.ticketId })
      .from(ticketProjectLinks)
      .where(inArray(ticketProjectLinks.projectId, filters.projectId))
      .all()
      .map((row) => row.ticketId);

    if (!linked.length) {
      return {
        items: [],
        meta: {
          jiraIssues: []
        }
      };
    }

    baseQueryFilters.push(inArray(tickets.id, linked));
  }

  const orderDirection = filters.dir === "asc" ? asc : desc;
  const configuredColumns = await ensureBoardColumnsPresent(app);
  const statusOrder = buildStatusOrderCaseExpression(tickets.status, configuredColumns.map((column) => column.status));

  let matchingTickets: TicketListItemRecord[];
  const whereClause = baseQueryFilters.length ? and(...baseQueryFilters) : undefined;

  switch (filters.sort) {
    case "ticket":
      matchingTickets = app.db
        .select()
        .from(tickets)
        .where(whereClause)
        .orderBy(orderDirection(tickets.key), orderDirection(tickets.title), desc(tickets.id))
        .all();
      break;
    case "jira":
      matchingTickets = app.db
        .select()
        .from(tickets)
        .where(whereClause)
        .orderBy(
          orderDirection(
            sql<string>`coalesce((
              select min(${ticketJiraIssueLinks.issueKey})
              from ${ticketJiraIssueLinks}
              where ${ticketJiraIssueLinks.ticketId} = ${tickets.id}
            ), '')`
          ),
          orderDirection(tickets.key),
          desc(tickets.id)
        )
        .all();
      break;
    case "status":
      matchingTickets = app.db
        .select()
        .from(tickets)
        .where(whereClause)
        .orderBy(orderDirection(statusOrder), orderDirection(tickets.key), desc(tickets.id))
        .all();
      break;
    case "priority": {
      const priorityRank = sql<number>`case
        when ${tickets.priority} = 'LOW' then 0
        when ${tickets.priority} = 'MEDIUM' then 1
        when ${tickets.priority} = 'HIGH' then 2
        when ${tickets.priority} = 'CRITICAL' then 3
        else 4
      end`;
      matchingTickets = app.db
        .select()
        .from(tickets)
        .where(whereClause)
        .orderBy(orderDirection(priorityRank), orderDirection(tickets.key), desc(tickets.id))
        .all();
      break;
    }
    case "projects":
      matchingTickets = app.db
        .select()
        .from(tickets)
        .where(whereClause)
        .orderBy(
          orderDirection(
            sql<string>`coalesce((
              select min(${projects.name})
              from ${ticketProjectLinks}
              inner join ${projects} on ${ticketProjectLinks.projectId} = ${projects.id}
              where ${ticketProjectLinks.ticketId} = ${tickets.id}
            ), '')`
          ),
          orderDirection(tickets.key),
          desc(tickets.id)
        )
        .all();
      break;
    case "updated":
    default:
      matchingTickets = app.db
        .select()
        .from(tickets)
        .where(whereClause)
        .orderBy(orderDirection(sql`coalesce(${tickets.archivedAt}, ${tickets.updatedAt})`), desc(tickets.id))
        .all();
      break;
  }

  const filteredTicketIds = matchingTickets.map((ticket) => ticket.id);
  const jiraFacetFilters = jiraIssueFilter
    ? baseQueryFilters.filter((filter) => filter !== jiraIssueFilter)
    : baseQueryFilters;
  const jiraFacetWhereClause = jiraFacetFilters.length ? and(...jiraFacetFilters) : undefined;
  const [decorations, jiraFacetTickets] = await Promise.all([
    loadTicketListDecorations(app.db, filteredTicketIds),
    jiraIssueFilter
      ? app.db.select().from(tickets).where(jiraFacetWhereClause).all()
      : Promise.resolve(matchingTickets)
  ]);

  const facetDecorations =
    filters.jiraIssue.length && jiraFacetTickets.length
      ? await loadTicketListDecorations(
          app.db,
          jiraFacetTickets.map((ticket) => ticket.id)
        )
      : decorations;

  return {
    items: buildTicketListItems(matchingTickets, decorations),
    meta: buildJiraIssueMeta(filters.jiraIssue.length ? jiraFacetTickets : matchingTickets, facetDecorations.jiraIssuesByTicketId)
  };
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
