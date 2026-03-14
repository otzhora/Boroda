import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ensureBoardColumnsPresent } from "./columns";
import { buildTicketListItems, loadTicketListDecorations } from "../tickets/service/shared";

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
  const decoratedTickets = buildTicketListItems(allTickets, await loadTicketListDecorations(app.db, ids));

  return {
    columns: configuredColumns.map((column) => ({
      status: column.status,
      label: column.label,
      tickets: decoratedTickets
        .filter((ticket) => ticket.status === column.status)
        .map((ticket) => ({
          id: ticket.id,
          key: ticket.key,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          updatedAt: ticket.updatedAt,
          contextsCount: ticket.contextsCount,
          projectBadges: ticket.projectBadges,
          jiraIssues: ticket.jiraIssues
        }))
    }))
  };
}
