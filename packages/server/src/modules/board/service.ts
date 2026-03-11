import { desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { projects, ticketJiraIssueLinks, ticketProjectLinks, tickets, workContexts } from "../../db/schema";
import { ensureBoardColumnsPresent } from "./columns";

export async function getBoard(
  app: FastifyInstance,
  filters: { projectId?: number; priority?: string; q?: string }
) {
  const configuredColumns = await ensureBoardColumnsPresent(app);
  const allTickets = await app.db.query.tickets.findMany({
    where: (table, operators) => {
      const clauses = [sql`${table.archivedAt} is null`];

      if (filters.priority) {
        clauses.push(operators.eq(table.priority, filters.priority));
      }

      if (filters.q) {
        clauses.push(
          sql`(
            ${table.title} like ${`%${filters.q}%`}
            or ${table.description} like ${`%${filters.q}%`}
            or exists (
              select 1
              from ticket_jira_issue_links
              where ticket_jira_issue_links.ticket_id = ${table.id}
                and (
                  ticket_jira_issue_links.issue_key like ${`%${filters.q}%`}
                  or ticket_jira_issue_links.issue_summary like ${`%${filters.q}%`}
                )
            )
          )`
        );
      }

      if (filters.projectId) {
        clauses.push(
          sql`${table.id} in (
            select ticket_id from ticket_project_links where project_id = ${filters.projectId}
          )`
        );
      }

      return sql.join(clauses, sql` and `);
    },
    orderBy: (table, operators) => [operators.desc(table.updatedAt)]
  });

  const ids = allTickets.map((ticket) => ticket.id);
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

  return {
    columns: configuredColumns.map((column) => ({
      status: column.status,
      label: column.label,
      tickets: allTickets
        .filter((ticket) => ticket.status === column.status)
        .map((ticket) => ({
          id: ticket.id,
          key: ticket.key,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          updatedAt: ticket.updatedAt,
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
        }))
    }))
  };
}
