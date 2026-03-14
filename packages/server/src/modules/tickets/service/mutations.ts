import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ensureBoardStatusExists } from "../../board/columns";
import { getJiraIssuesByKeys } from "../../integrations/jira/service";
import { projects, ticketJiraIssueLinks, ticketProjectLinks, tickets } from "../../../db/schema";
import { AppError } from "../../../shared/errors";
import { logServerEvent, withServerSpan } from "../../../shared/observability";
import { cleanupTicketImages } from "./images";
import { getTicketOrThrow } from "./queries";
import { nowIso, nextTicketKey, rethrowTicketConflict } from "./shared";
import {
  assertUniqueJiraIssueLinks,
  assertUniqueProjectLinks,
  deriveLegacyBranch,
  ensureProjectsExist,
  ensureWorkspaceFoldersExist,
  listProjectNamesById,
  replaceJiraIssueLinks,
  replaceProjectLinks,
  replaceWorkspaces
} from "./links";
import {
  formatJiraIssueLabel,
  normalizeJiraIssueKey,
  normalizeJiraIssueSummary,
  recordActivity,
  recordJiraIssueLinkChanges,
  recordProjectLinkChanges
} from "./activity";

export async function createTicket(
  app: FastifyInstance,
  input: {
    title: string;
    description: string;
    branch?: string | null;
    workspaces?: Array<{
      projectFolderId: number;
      branchName: string;
      baseBranch?: string | null;
      role?: string;
    }>;
    jiraIssues: Array<{ key: string; summary: string }>;
    status: string;
    priority: string;
    dueAt?: string | null;
    projectLinks: Array<{ projectId: number; relationship: string }>;
  }
) {
  return withServerSpan(
    app,
    "ticket.create",
    {
      title: input.title,
      status: input.status,
      priority: input.priority,
      projectLinkCount: input.projectLinks.length,
      jiraIssueCount: input.jiraIssues.length,
      workspaceCount: input.workspaces?.length ?? 0
    },
    async () => {
      const now = nowIso();
      await ensureBoardStatusExists(app, input.status);
      assertUniqueProjectLinks(input.projectLinks);
      assertUniqueJiraIssueLinks(input.jiraIssues);
      ensureProjectsExist(
        app.db,
        input.projectLinks.map((link) => link.projectId)
      );
      ensureWorkspaceFoldersExist(app.db, input.projectLinks, input.workspaces ?? []);
      const projectNamesById = listProjectNamesById(
        app.db,
        input.projectLinks.map((link) => link.projectId)
      );

      let ticket: typeof tickets.$inferSelect;
      try {
        ticket = app.db.transaction((tx) => {
          const key = nextTicketKey(tx);
          const createdTicket = tx
            .insert(tickets)
            .values({
              key,
              title: input.title,
              description: input.description,
              branch: deriveLegacyBranch(input.workspaces ?? [], input.branch ?? null),
              status: input.status,
              priority: input.priority,
              dueAt: input.dueAt ?? null,
              createdAt: now,
              updatedAt: now
            })
            .returning()
            .get();

          replaceProjectLinks(tx, createdTicket.id, input.projectLinks);
          replaceWorkspaces(tx, createdTicket.id, input.projectLinks, input.workspaces ?? []);
          replaceJiraIssueLinks(tx, createdTicket.id, input.jiraIssues);

          recordActivity(tx, createdTicket.id, "ticket.created", `Ticket ${createdTicket.key} created`);
          recordProjectLinkChanges(
            tx,
            createdTicket.id,
            [],
            input.projectLinks.map((link) => ({
              ...link,
              project: {
                name: projectNamesById.get(link.projectId) ?? `Project ${link.projectId}`
              }
            }))
          );
          recordJiraIssueLinkChanges(tx, createdTicket.id, [], input.jiraIssues);

          return createdTicket;
        });
      } catch (error) {
        rethrowTicketConflict(error);
      }

      logServerEvent(app, "info", "ticket.create.persisted", {
        ticketId: ticket.id,
        ticketKey: ticket.key
      });

      return getTicketOrThrow(app, ticket.id);
    }
  );
}

export async function updateTicket(
  app: FastifyInstance,
  id: number,
  input: Partial<{
    title: string;
    description: string;
    branch: string | null;
    workspaces: Array<{
      projectFolderId: number;
      branchName: string;
      baseBranch?: string | null;
      role?: string;
    }>;
    jiraIssues: Array<{ key: string; summary: string }>;
    status: string;
    priority: string;
    dueAt: string | null;
    projectLinks: Array<{ projectId: number; relationship: string }>;
  }>
) {
  return withServerSpan(
    app,
    "ticket.update",
    {
      ticketId: id,
      changedFields: Object.keys(input)
    },
    async () => {
      const existing = await getTicketOrThrow(app, id);
      if (input.status !== undefined) {
        await ensureBoardStatusExists(app, input.status);
      }
      const nextUpdatedAt = nowIso();
      const nextLegacyBranch =
        input.workspaces === undefined
          ? input.branch === undefined
            ? existing.branch
            : input.branch
          : deriveLegacyBranch(input.workspaces, input.branch === undefined ? existing.branch : input.branch);

      if (input.projectLinks) {
        assertUniqueProjectLinks(input.projectLinks);
        ensureProjectsExist(
          app.db,
          input.projectLinks.map((link) => link.projectId)
        );
      }

      if (input.jiraIssues) {
        assertUniqueJiraIssueLinks(input.jiraIssues);
      }

      if (input.workspaces) {
        ensureWorkspaceFoldersExist(app.db, input.projectLinks ?? existing.projectLinks, input.workspaces);
      }

      const nextProjectNamesById = input.projectLinks
        ? listProjectNamesById(
            app.db,
            input.projectLinks.map((link) => link.projectId)
          )
        : null;

      let updated: typeof tickets.$inferSelect;
      try {
        updated = app.db.transaction((tx) => {
          const nextTicket = tx
            .update(tickets)
            .set({
              title: input.title ?? existing.title,
              description: input.description ?? existing.description,
              branch: nextLegacyBranch,
              status: input.status ?? existing.status,
              priority: input.priority ?? existing.priority,
              dueAt: input.dueAt === undefined ? existing.dueAt : input.dueAt,
              updatedAt: nextUpdatedAt
            })
            .where(eq(tickets.id, id))
            .returning()
            .get();

          if (input.projectLinks) {
            replaceProjectLinks(tx, id, input.projectLinks);
            recordProjectLinkChanges(
              tx,
              id,
              existing.projectLinks.map((link) => ({
                projectId: link.projectId,
                relationship: link.relationship,
                project: link.project
              })),
              input.projectLinks.map((link) => ({
                ...link,
                project: {
                  name: nextProjectNamesById?.get(link.projectId) ?? `Project ${link.projectId}`
                }
              }))
            );
          }

          if (input.workspaces) {
            replaceWorkspaces(tx, id, input.projectLinks ?? existing.projectLinks, input.workspaces);
          }

          if (input.jiraIssues) {
            replaceJiraIssueLinks(tx, id, input.jiraIssues);
            recordJiraIssueLinkChanges(
              tx,
              id,
              existing.jiraIssues.map((issue) => ({
                key: issue.key,
                summary: issue.summary
              })),
              input.jiraIssues
            );
          }

          if (input.status && input.status !== existing.status) {
            recordActivity(tx, id, "ticket.status.changed", `Status changed to ${input.status}`, {
              status: input.status
            });
          }

          if (input.priority && input.priority !== existing.priority) {
            recordActivity(tx, id, "ticket.priority.changed", `Priority changed to ${input.priority}`);
          }

          return nextTicket;
        });
      } catch (error) {
        rethrowTicketConflict(error);
      }

      if (input.description !== undefined && input.description !== existing.description) {
        await cleanupTicketImages(app, id, input.description);
      }

      return getTicketOrThrow(app, updated.id);
    }
  );
}

export async function refreshTicketJiraIssues(app: FastifyInstance, id: number) {
  return withServerSpan(
    app,
    "ticket.jira.refresh",
    {
      ticketId: id
    },
    async () => {
      const existing = await getTicketOrThrow(app, id);

      if (!existing.jiraIssues.length) {
        logServerEvent(app, "info", "ticket.jira.refresh.skipped", {
          ticketId: id,
          reason: "no_linked_issues"
        });
        return existing;
      }

      const refreshedIssues = await getJiraIssuesByKeys(
        app,
        existing.jiraIssues.map((issue) => issue.key)
      );
      const refreshedByKey = new Map(
        refreshedIssues.map((issue) => [normalizeJiraIssueKey(issue.key), issue.summary.trim()])
      );
      const nextIssues = existing.jiraIssues.map((issue) => ({
        key: issue.key,
        summary: refreshedByKey.get(normalizeJiraIssueKey(issue.key)) ?? issue.summary
      }));

      try {
        app.db.transaction((tx) => {
          replaceJiraIssueLinks(tx, id, nextIssues);

          const changedCount = existing.jiraIssues.filter((issue) => {
            const nextSummary = refreshedByKey.get(normalizeJiraIssueKey(issue.key));
            return nextSummary !== undefined && nextSummary !== issue.summary;
          }).length;

          if (changedCount > 0) {
            recordActivity(
              tx,
              id,
              "ticket.jira_issue_refreshed",
              changedCount === 1 ? "Refreshed 1 Jira issue summary" : `Refreshed ${changedCount} Jira issue summaries`
            );
          }

          logServerEvent(app, "info", "ticket.jira.refresh.result", {
            ticketId: id,
            linkedIssueCount: existing.jiraIssues.length,
            changedCount
          });
        });
      } catch (error) {
        rethrowTicketConflict(error);
      }

      return getTicketOrThrow(app, id);
    }
  );
}

export async function addTicketProjectLink(
  app: FastifyInstance,
  ticketId: number,
  input: { projectId: number; relationship: string }
) {
  const existing = await getTicketOrThrow(app, ticketId);
  const nextLinks = [
    ...existing.projectLinks.map((link) => ({
      projectId: link.projectId,
      relationship: link.relationship
    })),
    input
  ];

  assertUniqueProjectLinks(nextLinks);
  ensureProjectsExist(app.db, [input.projectId]);
  const linkedProject = app.db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .get();

  try {
    return app.db.transaction((tx) => {
      const created = tx
        .insert(ticketProjectLinks)
        .values({
          ticketId,
          projectId: input.projectId,
          relationship: input.relationship,
          createdAt: nowIso()
        })
        .returning()
        .get();

      tx.update(tickets)
        .set({ updatedAt: nowIso() })
        .where(eq(tickets.id, ticketId))
        .run();

      recordActivity(
        tx,
        ticketId,
        "ticket.project_linked",
        `${linkedProject?.name ?? `Project ${input.projectId}`} linked as ${input.relationship.toLowerCase()}`
      );

      return created;
    });
  } catch (error) {
    rethrowTicketConflict(error);
  }
}

export async function addTicketJiraIssueLink(
  app: FastifyInstance,
  ticketId: number,
  input: { key: string; summary: string }
) {
  const existing = await getTicketOrThrow(app, ticketId);
  const nextIssues = [
    ...existing.jiraIssues.map((issue) => ({
      key: issue.key,
      summary: issue.summary
    })),
    input
  ];

  assertUniqueJiraIssueLinks(nextIssues);

  try {
    return app.db.transaction((tx) => {
      const created = tx
        .insert(ticketJiraIssueLinks)
        .values({
          ticketId,
          issueKey: normalizeJiraIssueKey(input.key),
          issueSummary: normalizeJiraIssueSummary(input.summary),
          createdAt: nowIso()
        })
        .returning()
        .get();

      tx.update(tickets)
        .set({ updatedAt: nowIso() })
        .where(eq(tickets.id, ticketId))
        .run();

      recordActivity(
        tx,
        ticketId,
        "ticket.jira_issue_linked",
        `${formatJiraIssueLabel({
          key: normalizeJiraIssueKey(input.key),
          summary: normalizeJiraIssueSummary(input.summary)
        })} linked from Jira`
      );

      return {
        id: created.id,
        ticketId: created.ticketId,
        key: created.issueKey,
        summary: created.issueSummary,
        createdAt: created.createdAt
      };
    });
  } catch (error) {
    rethrowTicketConflict(error);
  }
}

export async function deleteTicketProjectLink(app: FastifyInstance, id: number) {
  const existing = await app.db.query.ticketProjectLinks.findFirst({
    where: eq(ticketProjectLinks.id, id),
    with: {
      project: true
    }
  });

  if (!existing) {
    throw new AppError(404, "TICKET_PROJECT_LINK_NOT_FOUND", "Ticket project link not found");
  }

  app.db.transaction((tx) => {
    tx.delete(ticketProjectLinks).where(eq(ticketProjectLinks.id, id)).run();
    tx.update(tickets)
      .set({ updatedAt: nowIso() })
      .where(eq(tickets.id, existing.ticketId))
      .run();
    recordActivity(
      tx,
      existing.ticketId,
      "ticket.project_unlinked",
      `${existing.project.name} removed from ticket`
    );
  });
  return { ok: true };
}
