import type { FastifyInstance } from "fastify";
import type { z } from "zod";
import {
  boardColumns,
  projectFolders,
  projects,
  sequences,
  ticketActivities,
  ticketJiraIssueLinks,
  ticketProjectLinks,
  tickets,
  workContexts
} from "../../db/schema";
import { DEFAULT_BOARD_COLUMNS, ensureColumnsForStatuses } from "../board/columns";
import { AppError } from "../../shared/errors";
import { importWorkspaceSchema } from "./schemas";

type ImportWorkspacePayload = z.infer<typeof importWorkspaceSchema>;

export async function exportWorkspace(app: FastifyInstance) {
  return {
    exportedAt: new Date().toISOString(),
    data: {
      sequences: app.db.select().from(sequences).all(),
      projects: app.db.select().from(projects).all(),
      projectFolders: app.db.select().from(projectFolders).all(),
      boardColumns: app.db.select().from(boardColumns).all(),
      tickets: app.db.select().from(tickets).all(),
      ticketProjectLinks: app.db.select().from(ticketProjectLinks).all(),
      ticketJiraIssueLinks: app.db.select().from(ticketJiraIssueLinks).all(),
      workContexts: app.db.select().from(workContexts).all(),
      ticketActivities: app.db.select().from(ticketActivities).all()
    }
  };
}

function workspaceHasData(app: FastifyInstance) {
  return (
    app.db.select({ id: projects.id }).from(projects).get() !== undefined ||
    app.db.select({ id: tickets.id }).from(tickets).get() !== undefined
  );
}

export async function importWorkspace(
  app: FastifyInstance,
  payload: ImportWorkspacePayload
) {
  if (!payload.replaceExisting && workspaceHasData(app)) {
    throw new AppError(
      409,
      "IMPORT_REQUIRES_REPLACE",
      "Workspace already contains data. Re-run import with replacement enabled."
    );
  }

  const { data } = payload.snapshot;
  const importedTicketJiraIssueLinks =
    data.ticketJiraIssueLinks.length ||
    data.tickets.filter((ticket) => Boolean(ticket.jiraTicket?.trim())).length;

  app.db.transaction((tx) => {
    tx.delete(ticketActivities).run();
    tx.delete(workContexts).run();
    tx.delete(ticketJiraIssueLinks).run();
    tx.delete(ticketProjectLinks).run();
    tx.delete(tickets).run();
    tx.delete(boardColumns).run();
    tx.delete(projectFolders).run();
    tx.delete(projects).run();
    tx.delete(sequences).run();

    if (data.sequences.length) {
      tx.insert(sequences).values(data.sequences).run();
    }

    if (data.projects.length) {
      tx.insert(projects).values(data.projects).run();
    }

    if (data.projectFolders.length) {
      tx.insert(projectFolders).values(data.projectFolders).run();
    }

    const importedBoardColumns = data.boardColumns.length
      ? data.boardColumns.map((column) => ({
          status: column.status,
          label: column.label,
          position: column.position,
          createdAt: column.createdAt ?? new Date().toISOString(),
          updatedAt: column.updatedAt ?? new Date().toISOString()
        }))
      : DEFAULT_BOARD_COLUMNS.map((column) => ({
          ...column,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

    tx.insert(boardColumns).values(importedBoardColumns).run();

    if (data.tickets.length) {
      tx.insert(tickets)
        .values(
          data.tickets.map((ticket) => ({
            id: ticket.id,
            key: ticket.key,
            title: ticket.title,
            description: ticket.description,
            branch: ticket.branch,
            status: ticket.status,
            priority: ticket.priority,
            dueAt: ticket.dueAt,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            archivedAt: ticket.archivedAt
          }))
        )
        .run();

      ensureColumnsForStatuses(
        tx,
        data.tickets.map((ticket) => ticket.status)
      );
    }

    if (data.ticketProjectLinks.length) {
      tx.insert(ticketProjectLinks).values(data.ticketProjectLinks).run();
    }

    if (data.ticketJiraIssueLinks.length) {
      tx.insert(ticketJiraIssueLinks).values(data.ticketJiraIssueLinks).run();
    } else {
      const legacyLinks = data.tickets
        .map((ticket) => {
          const legacyKey = ticket.jiraTicket?.trim();

          if (!legacyKey) {
            return null;
          }

          return {
            ticketId: ticket.id,
            issueKey: legacyKey,
            issueSummary: "",
            createdAt: ticket.updatedAt
          };
        })
        .filter(
          (link): link is { ticketId: number; issueKey: string; issueSummary: string; createdAt: string } =>
            link !== null
        );

      if (legacyLinks.length) {
        tx.insert(ticketJiraIssueLinks).values(legacyLinks).run();
      }
    }

    if (data.workContexts.length) {
      tx.insert(workContexts).values(data.workContexts).run();
    }

    if (data.ticketActivities.length) {
      tx.insert(ticketActivities).values(data.ticketActivities).run();
    }
  });

  return {
    ok: true,
    importedAt: new Date().toISOString(),
    counts: {
      sequences: data.sequences.length,
      projects: data.projects.length,
      projectFolders: data.projectFolders.length,
      tickets: data.tickets.length,
      ticketProjectLinks: data.ticketProjectLinks.length,
      ticketJiraIssueLinks: importedTicketJiraIssueLinks,
      workContexts: data.workContexts.length,
      ticketActivities: data.ticketActivities.length
    }
  };
}
