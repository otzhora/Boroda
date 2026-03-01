import { desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { projects, ticketProjectLinks, tickets, workContexts } from "../../db/schema";

const STATUS_ORDER = [
  "INBOX",
  "READY",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "MANUAL_UI",
  "DONE"
] as const;

const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
  INBOX: "Inbox",
  READY: "Ready",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In Review",
  MANUAL_UI: "Manual UI",
  DONE: "Done"
};

export async function getBoard(
  app: FastifyInstance,
  filters: { projectId?: number; priority?: string; q?: string }
) {
  const allTickets = await app.db.query.tickets.findMany({
    where: (table, operators) => {
      const clauses = [sql`${table.archivedAt} is null`];

      if (filters.priority) {
        clauses.push(operators.eq(table.priority, filters.priority));
      }

      if (filters.q) {
        clauses.push(
          sql`(${table.title} like ${`%${filters.q}%`} or ${table.description} like ${`%${filters.q}%`})`
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

  return {
    columns: STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      tickets: allTickets
        .filter((ticket) => ticket.status === status)
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
              relationship: link.relationship
            }))
        }))
    }))
  };
}
