import { existsSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { projects, tickets } from "../../../db/schema";
import { AppError } from "../../../shared/errors";
import { logServerEvent, withServerSpan } from "../../../shared/observability";
import { isWorkspaceDirty, removeWorkspaceWorktree } from "../../integrations/open-in/git-workspaces";
import { recordActivity } from "./activity";
import { getTicketOrThrow } from "./queries";
import { nowIso, type DbExecutor } from "./shared";

interface ArchiveCandidateWorkspace {
  id: number;
  branchName: string;
  worktreePath: string;
}

function listArchivableWorktrees(
  workspaces: Array<{
    id: number;
    branchName: string;
    worktreePath: string | null;
    createdByBoroda: boolean;
  }>
) {
  return workspaces
    .filter((workspace) => workspace.createdByBoroda && typeof workspace.worktreePath === "string" && workspace.worktreePath.trim().length > 0)
    .map((workspace) => ({
      id: workspace.id,
      branchName: workspace.branchName,
      worktreePath: workspace.worktreePath as string
    } satisfies ArchiveCandidateWorkspace));
}

export type PreparedTicketArchive = {
  existing: Awaited<ReturnType<typeof getTicketOrThrow>>;
  archivableWorktrees: Array<{
    id: number;
    branchName: string;
    worktreePath: string;
  }>;
  dirtyWorktrees: Array<{
    workspaceId: number;
    branchName: string;
    worktreePath: string;
  }>;
};

function assertPreparedTicketArchiveCanProceed(
  prepared: PreparedTicketArchive,
  options?: { force?: boolean }
) {
  if (prepared.existing.archivedAt) {
    return;
  }

  if (prepared.dirtyWorktrees.length && !options?.force) {
    throw new AppError(
      409,
      "TICKET_ARCHIVE_DIRTY_WORKTREES",
      "One or more ticket worktrees have uncommitted changes",
      { dirtyWorktrees: prepared.dirtyWorktrees }
    );
  }
}

function applyTicketArchivedState(
  db: DbExecutor,
  ticket: { id: number; key: string },
  archivedAt: string
) {
  db.update(tickets)
    .set({
      archivedAt,
      updatedAt: archivedAt
    })
    .where(eq(tickets.id, ticket.id))
    .run();
  recordActivity(db, ticket.id, "ticket.archived", `Ticket ${ticket.key} moved to history`);
}

export function archivePreparedTicketsForCommit(
  preparedTickets: PreparedTicketArchive[],
  options?: { force?: boolean }
) {
  for (const prepared of preparedTickets) {
    assertPreparedTicketArchiveCanProceed(prepared, options);
  }

  for (const prepared of preparedTickets) {
    for (const workspace of prepared.archivableWorktrees) {
      removeWorkspaceWorktree(workspace.worktreePath, {
        force: options?.force
      });
    }
  }
}

export function archivePreparedTicketsInTransaction(
  db: DbExecutor,
  preparedTickets: PreparedTicketArchive[],
  archivedAt: string
) {
  for (const prepared of preparedTickets) {
    if (prepared.existing.archivedAt) {
      continue;
    }

    applyTicketArchivedState(db, prepared.existing, archivedAt);
  }
}

export function unarchiveTicketsInTransaction(
  db: DbExecutor,
  restoredTickets: Array<{ id: number; key: string }>,
  restoredAt: string
) {
  for (const ticket of restoredTickets) {
    db.update(tickets)
      .set({
        archivedAt: null,
        updatedAt: restoredAt
      })
      .where(eq(tickets.id, ticket.id))
      .run();
    recordActivity(db, ticket.id, "ticket.unarchived", `Ticket ${ticket.key} restored from history`);
  }
}

export async function deleteTicket(app: FastifyInstance, id: number, options?: { force?: boolean }) {
  return withServerSpan(
    app,
    "ticket.archive",
    {
      ticketId: id
    },
    async () => {
      const prepared = await prepareTicketArchive(app, id);
      return archivePreparedTicket(app, prepared, options);
    }
  );
}

export async function prepareTicketArchive(app: FastifyInstance, id: number): Promise<PreparedTicketArchive> {
  const existing = await getTicketOrThrow(app, id);
  const archivableWorktrees = listArchivableWorktrees(existing.workspaces);
  const dirtyWorktrees = archivableWorktrees
    .filter((workspace) => existsSync(workspace.worktreePath))
    .filter((workspace) => isWorkspaceDirty(workspace.worktreePath))
    .map((workspace) => ({
      workspaceId: workspace.id,
      branchName: workspace.branchName,
      worktreePath: workspace.worktreePath
    }));

  return {
    existing,
    archivableWorktrees,
    dirtyWorktrees
  };
}

export async function archivePreparedTicket(
  app: FastifyInstance,
  prepared: PreparedTicketArchive,
  options?: { force?: boolean }
) {
  const { existing } = prepared;

  if (existing.archivedAt) {
    logServerEvent(app, "info", "ticket.archive.skipped", {
      ticketId: existing.id,
      ticketKey: existing.key,
      reason: "already_archived"
    });
    return { ok: true };
  }

  assertPreparedTicketArchiveCanProceed(prepared, options);
  archivePreparedTicketsForCommit([prepared], options);

  const archivedAt = nowIso();
  app.db.transaction((tx) => {
    applyTicketArchivedState(tx, existing, archivedAt);
  });
  return { ok: true };
}

export async function unarchiveTicket(app: FastifyInstance, id: number) {
  return withServerSpan(
    app,
    "ticket.unarchive",
    {
      ticketId: id
    },
    async () => {
      const existing = await getTicketOrThrow(app, id);

      if (!existing.archivedAt) {
        logServerEvent(app, "info", "ticket.unarchive.skipped", {
          ticketId: existing.id,
          ticketKey: existing.key,
          reason: "already_active"
        });
        return { ok: true };
      }

      const restoredAt = nowIso();
      const archivedLinkedProjectIds = existing.projectLinks
        .filter((link) => link.project.archivedAt)
        .map((link) => link.projectId);
      const restoredTickets = [{ id: existing.id, key: existing.key }];

      app.db.transaction((tx) => {
        if (archivedLinkedProjectIds.length) {
          tx.update(projects)
            .set({
              archivedAt: null,
              updatedAt: restoredAt
            })
            .where(inArray(projects.id, archivedLinkedProjectIds))
            .run();
        }

        unarchiveTicketsInTransaction(tx, restoredTickets, restoredAt);
      });
      return { ok: true };
    }
  );
}
