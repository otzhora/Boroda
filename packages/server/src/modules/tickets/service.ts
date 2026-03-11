import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { getConfig } from "../../config";
import { ensureBoardStatusExists } from "../board/columns";
import { getJiraIssuesByKeys } from "../integrations/jira/service";
import { isWorkspaceDirty, removeWorkspaceWorktree } from "../integrations/open-in/git-workspaces";
import {
  projectFolders,
  projects,
  sequences,
  ticketActivities,
  ticketJiraIssueLinks,
  ticketProjectLinks,
  ticketWorkspaces,
  tickets,
  workContexts
} from "../../db/schema";
import { AppError } from "../../shared/errors";
import { getProjectFolderSetupInfo } from "../../shared/worktree-setup";
import { logServerEvent, withServerSpan } from "../../shared/observability";

const supportedTicketImageMimeTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"]
]);

function nowIso() {
  return new Date().toISOString();
}

function getTicketUploadsRoot() {
  return path.resolve(getConfig().uploadsPath, "tickets");
}

function getTicketUploadsDirectory(app: FastifyInstance, ticketId: number) {
  return path.resolve(getTicketUploadsRoot(), String(ticketId));
}

function getReferencedTicketImageFilenames(description: string, ticketId: number) {
  const imageMatches = description.matchAll(
    new RegExp(`/api/tickets/${ticketId}/images/([^\\s)]+)`, "g")
  );

  return new Set(
    Array.from(imageMatches, (match) => {
      try {
        return decodeURIComponent(match[1] ?? "");
      } catch {
        return match[1] ?? "";
      }
    }).filter(Boolean)
  );
}

function sanitizeFilenameSegment(input: string) {
  const normalized = input
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "image";
}

function filenameToAltText(filename: string) {
  const baseName = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return baseName || "Pasted image";
}

function escapeMarkdownText(input: string) {
  return input.replace(/[[\]\\]/g, "\\$&");
}

function resolveTicketImageContentType(filename: string) {
  const extension = path.extname(filename).slice(1).toLowerCase();

  for (const [contentType, mappedExtension] of supportedTicketImageMimeTypes) {
    if (mappedExtension === extension) {
      return contentType;
    }
  }

  return "application/octet-stream";
}

function assertTicketImagePath(app: FastifyInstance, ticketId: number, filename: string) {
  const ticketDirectory = getTicketUploadsDirectory(app, ticketId);
  const resolvedPath = path.resolve(ticketDirectory, filename);

  if (path.dirname(resolvedPath) !== ticketDirectory) {
    throw new AppError(400, "INVALID_TICKET_IMAGE_PATH", "Invalid ticket image path");
  }

  return resolvedPath;
}

async function cleanupTicketImages(
  app: FastifyInstance,
  ticketId: number,
  nextDescription: string
) {
  const ticketDirectory = getTicketUploadsDirectory(app, ticketId);
  const nextFilenames = getReferencedTicketImageFilenames(nextDescription, ticketId);
  let directoryEntries: string[] = [];

  try {
    directoryEntries = await readdir(ticketDirectory);
  } catch {
    return;
  }

  const orphanedFilenames = directoryEntries.filter((filename) => !nextFilenames.has(filename));

  if (!orphanedFilenames.length) {
    return;
  }

  await Promise.all(
    orphanedFilenames.map(async (filename) => {
      try {
        await rm(assertTicketImagePath(app, ticketId, filename), { force: true });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
      }
    })
  );

  try {
    const remainingEntries = await readdir(ticketDirectory);

    if (!remainingEntries.length) {
      await rm(ticketDirectory, { recursive: true, force: true });
    }
  } catch {
    return;
  }
}

function recordActivity(
  app: FastifyInstance,
  ticketId: number,
  type: string,
  message: string,
  meta: Record<string, unknown> = {}
) {
  app.db.insert(ticketActivities).values({
    ticketId,
    type,
    message,
    metaJson: JSON.stringify(meta),
    createdAt: nowIso()
  }).run();
}

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
    }));
}

type PreparedTicketArchive = {
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

function rethrowTicketConflict(error: unknown): never {
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

function nextTicketKey(app: FastifyInstance) {
  const existing = app.db
    .select()
    .from(sequences)
    .where(eq(sequences.name, "ticket"))
    .get();

  if (!existing) {
    app.db.insert(sequences).values({ name: "ticket", value: 1 }).run();
    return "BRD-1";
  }

  const nextValue = existing.value + 1;
  app.db
    .update(sequences)
    .set({ value: nextValue })
    .where(eq(sequences.name, "ticket"))
    .run();
  return `BRD-${nextValue}`;
}

function assertUniqueProjectLinks(projectLinks: Array<{ projectId: number; relationship: string }>) {
  const projectIds = new Set<number>();
  let primaryCount = 0;

  for (const link of projectLinks) {
    if (projectIds.has(link.projectId)) {
      throw new AppError(400, "TICKET_PROJECT_DUPLICATE", "Each project can only be linked once", {
        projectId: link.projectId
      });
    }

    projectIds.add(link.projectId);

    if (link.relationship === "PRIMARY") {
      primaryCount += 1;
    }
  }

  if (primaryCount > 1) {
    throw new AppError(
      400,
      "TICKET_PRIMARY_PROJECT_CONFLICT",
      "A ticket can only have one primary project"
    );
  }
}

function serializeProjectLink(link: { projectId: number; relationship: string }) {
  return `${link.projectId}:${link.relationship}`;
}

function normalizeJiraIssueKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeJiraIssueSummary(value: string) {
  return value.trim();
}

function assertUniqueJiraIssueLinks(jiraIssues: Array<{ key: string; summary: string }>) {
  const issueKeys = new Set<string>();

  for (const issue of jiraIssues) {
    const normalizedKey = normalizeJiraIssueKey(issue.key);

    if (!normalizedKey) {
      throw new AppError(400, "TICKET_JIRA_KEY_REQUIRED", "Jira issue key is required");
    }

    if (issueKeys.has(normalizedKey)) {
      throw new AppError(400, "TICKET_JIRA_DUPLICATE", "Each Jira issue can only be linked once", {
        key: normalizedKey
      });
    }

    issueKeys.add(normalizedKey);
  }
}

function serializeJiraIssueLink(link: { key: string }) {
  return normalizeJiraIssueKey(link.key);
}

async function ensureProjectsExist(app: FastifyInstance, projectIds: number[]) {
  const uniqueProjectIds = [...new Set(projectIds)];

  if (!uniqueProjectIds.length) {
    return;
  }

  const existingProjects = app.db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.id, uniqueProjectIds))
    .all();

  if (existingProjects.length !== uniqueProjectIds.length) {
    const existingProjectIds = new Set(existingProjects.map((project) => project.id));
    const missingProjectId = uniqueProjectIds.find((projectId) => !existingProjectIds.has(projectId));
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found", {
      projectId: missingProjectId
    });
  }
}

async function loadTicketProjectLinks(app: FastifyInstance, ticketId: number) {
  const projectLinks = await app.db.query.ticketProjectLinks.findMany({
    where: eq(ticketProjectLinks.ticketId, ticketId),
    with: {
      project: {
        with: {
          folders: true
        }
      }
    }
  });

  return projectLinks.map((link) => ({
    ...link,
    project: {
      ...link.project,
      folders: link.project.folders.map((folder) => ({
        ...folder,
        setupInfo: getProjectFolderSetupInfo(folder.path)
      }))
    }
  }));
}

async function loadTicketJiraIssueLinks(app: FastifyInstance, ticketId: number) {
  return app.db.query.ticketJiraIssueLinks.findMany({
    where: eq(ticketJiraIssueLinks.ticketId, ticketId),
    orderBy: [asc(ticketJiraIssueLinks.id)]
  });
}

async function loadTicketWorkspaces(app: FastifyInstance, ticketId: number) {
  const workspaces = await app.db.query.ticketWorkspaces.findMany({
    where: eq(ticketWorkspaces.ticketId, ticketId),
    with: {
      projectFolder: {
        with: {
          project: true
        }
      }
    },
    orderBy: [asc(ticketWorkspaces.id)]
  });

  return workspaces.map((workspace) => ({
    ...workspace,
    projectFolder: {
      ...workspace.projectFolder,
      setupInfo: getProjectFolderSetupInfo(workspace.projectFolder.path)
    }
  }));
}

function normalizeWorkspaceRole(role: string | undefined) {
  const normalized = role?.trim().toLowerCase();
  return normalized && normalized.length ? normalized : "primary";
}

function normalizeWorkspaceBranch(branchName: string) {
  return branchName.trim();
}

function deriveLegacyBranch(
  workspaces: Array<{ branchName: string; role?: string | null }>,
  fallbackBranch?: string | null
) {
  const preferredWorkspace =
    workspaces.find((workspace) => normalizeWorkspaceRole(workspace.role ?? undefined) === "primary") ?? workspaces[0];

  return preferredWorkspace?.branchName ?? fallbackBranch ?? null;
}

async function ensureWorkspaceFoldersExist(
  app: FastifyInstance,
  projectLinks: Array<{ projectId: number }>,
  workspaces: Array<{ projectFolderId: number }>
) {
  if (!workspaces.length) {
    return [];
  }

  const folderIds = [...new Set(workspaces.map((workspace) => workspace.projectFolderId))];
  const existingFolders = app.db.query.projectFolders.findMany({
    where: inArray(projectFolders.id, folderIds),
    with: {
      project: true
    }
  });

  const folders = await existingFolders;
  if (folders.length !== folderIds.length) {
    const existingFolderIds = new Set(folders.map((folder) => folder.id));
    const missingFolderId = folderIds.find((folderId) => !existingFolderIds.has(folderId));
    throw new AppError(404, "PROJECT_FOLDER_NOT_FOUND", "Project folder not found", {
      projectFolderId: missingFolderId
    });
  }

  const linkedProjectIds = new Set(projectLinks.map((link) => link.projectId));
  const unlinkedFolder = folders.find((folder) => !linkedProjectIds.has(folder.projectId));
  if (unlinkedFolder) {
    throw new AppError(400, "WORKSPACE_PROJECT_FOLDER_NOT_LINKED", "Workspace folder must belong to a project linked to the ticket", {
      projectFolderId: unlinkedFolder.id,
      projectId: unlinkedFolder.projectId
    });
  }

  return folders;
}

async function replaceWorkspaces(
  app: FastifyInstance,
  ticketId: number,
  projectLinks: Array<{ projectId: number }>,
  workspaces: Array<{ projectFolderId: number; branchName: string; baseBranch?: string | null; role?: string }>
) {
  const normalizedWorkspaces = workspaces
    .map((workspace) => ({
      projectFolderId: workspace.projectFolderId,
      branchName: normalizeWorkspaceBranch(workspace.branchName),
      baseBranch: workspace.baseBranch?.trim() || null,
      role: normalizeWorkspaceRole(workspace.role)
    }))
    .filter((workspace) => workspace.branchName.length > 0);

  const uniqueKeys = new Set<string>();
  for (const workspace of normalizedWorkspaces) {
    const key = `${workspace.projectFolderId}:${workspace.branchName.toLowerCase()}`;
    if (uniqueKeys.has(key)) {
      throw new AppError(400, "TICKET_WORKSPACE_DUPLICATE", "Each workspace branch can only be linked once per folder", {
        projectFolderId: workspace.projectFolderId,
        branchName: workspace.branchName
      });
    }
    uniqueKeys.add(key);
  }

  await ensureWorkspaceFoldersExist(app, projectLinks, normalizedWorkspaces);
  app.db.delete(ticketWorkspaces).where(eq(ticketWorkspaces.ticketId, ticketId)).run();

  if (!normalizedWorkspaces.length) {
    return;
  }

  const now = nowIso();
  app.db
    .insert(ticketWorkspaces)
    .values(
      normalizedWorkspaces.map((workspace) => ({
        ticketId,
        projectFolderId: workspace.projectFolderId,
        branchName: workspace.branchName,
        baseBranch: workspace.baseBranch,
        role: workspace.role,
        createdByBoroda: true,
        createdAt: now,
        updatedAt: now
      }))
    )
    .run();
}

function recordProjectLinkChanges(
  app: FastifyInstance,
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
        app,
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
        app,
        ticketId,
        "ticket.project_unlinked",
        `${projectName} removed from ticket`
      );
    }
  }
}

function formatJiraIssueLabel(issue: { key: string; summary?: string | null }) {
  const summary = issue.summary?.trim();
  return summary ? `${issue.key} ${summary}` : issue.key;
}

function recordJiraIssueLinkChanges(
  app: FastifyInstance,
  ticketId: number,
  previousIssues: Array<{ key: string; summary: string }>,
  nextIssues: Array<{ key: string; summary: string }>
) {
  const previousByKey = new Map(previousIssues.map((issue) => [serializeJiraIssueLink(issue), issue]));
  const nextByKey = new Map(nextIssues.map((issue) => [serializeJiraIssueLink(issue), issue]));

  for (const [key, issue] of nextByKey) {
    if (!previousByKey.has(key)) {
      recordActivity(
        app,
        ticketId,
        "ticket.jira_issue_linked",
        `${formatJiraIssueLabel(issue)} linked from Jira`
      );
    }
  }

  for (const [key, issue] of previousByKey) {
    if (!nextByKey.has(key)) {
      recordActivity(
        app,
        ticketId,
        "ticket.jira_issue_unlinked",
        `${formatJiraIssueLabel(issue)} removed from Jira links`
      );
    }
  }
}

async function replaceProjectLinks(
  app: FastifyInstance,
  ticketId: number,
  projectLinks: Array<{ projectId: number; relationship: string }>
) {
  assertUniqueProjectLinks(projectLinks);
  await ensureProjectsExist(
    app,
    projectLinks.map((link) => link.projectId)
  );
  app.db.delete(ticketProjectLinks).where(eq(ticketProjectLinks.ticketId, ticketId)).run();

  if (!projectLinks.length) {
    return;
  }

  const now = nowIso();
  app.db
    .insert(ticketProjectLinks)
    .values(
      projectLinks.map((link) => ({
        ticketId,
        projectId: link.projectId,
        relationship: link.relationship,
        createdAt: now
      }))
    )
    .run();
}

async function replaceJiraIssueLinks(
  app: FastifyInstance,
  ticketId: number,
  jiraIssues: Array<{ key: string; summary: string }>
) {
  assertUniqueJiraIssueLinks(jiraIssues);
  app.db.delete(ticketJiraIssueLinks).where(eq(ticketJiraIssueLinks.ticketId, ticketId)).run();

  if (!jiraIssues.length) {
    return;
  }

  const now = nowIso();
  app.db
    .insert(ticketJiraIssueLinks)
    .values(
      jiraIssues.map((issue) => ({
        ticketId,
        issueKey: normalizeJiraIssueKey(issue.key),
        issueSummary: normalizeJiraIssueSummary(issue.summary),
        createdAt: now
      }))
    )
    .run();
}

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
      const key = nextTicketKey(app);
      await ensureBoardStatusExists(app, input.status);
      assertUniqueProjectLinks(input.projectLinks);
      assertUniqueJiraIssueLinks(input.jiraIssues);
      await ensureProjectsExist(
        app,
        input.projectLinks.map((link) => link.projectId)
      );
      const ticket = app.db
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

      try {
        await replaceProjectLinks(app, ticket.id, input.projectLinks);
        await replaceWorkspaces(app, ticket.id, input.projectLinks, input.workspaces ?? []);
        await replaceJiraIssueLinks(app, ticket.id, input.jiraIssues);
      } catch (error) {
        app.db.delete(tickets).where(eq(tickets.id, ticket.id)).run();
        rethrowTicketConflict(error);
      }

      recordActivity(app, ticket.id, "ticket.created", `Ticket ${ticket.key} created`);
      recordProjectLinkChanges(app, ticket.id, [], await loadTicketProjectLinks(app, ticket.id));
      recordJiraIssueLinkChanges(app, ticket.id, [], input.jiraIssues);
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

      const updated = app.db
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
        assertUniqueProjectLinks(input.projectLinks);
        await ensureProjectsExist(
          app,
          input.projectLinks.map((link) => link.projectId)
        );
      }

      if (input.jiraIssues) {
        assertUniqueJiraIssueLinks(input.jiraIssues);
      }

      if (input.workspaces) {
        await ensureWorkspaceFoldersExist(app, input.projectLinks ?? existing.projectLinks, input.workspaces);
      }

      if (input.projectLinks) {
        try {
          await replaceProjectLinks(app, id, input.projectLinks);
        } catch (error) {
          rethrowTicketConflict(error);
        }

        const previousLinks = existing.projectLinks.map((link) => ({
          projectId: link.projectId,
          relationship: link.relationship,
          project: link.project
        }));
        const nextLinks = await loadTicketProjectLinks(app, id);
        recordProjectLinkChanges(app, id, previousLinks, nextLinks);
      }

      if (input.workspaces) {
        await replaceWorkspaces(app, id, input.projectLinks ?? existing.projectLinks, input.workspaces);
      }

      if (input.jiraIssues) {
        try {
          await replaceJiraIssueLinks(app, id, input.jiraIssues);
        } catch (error) {
          rethrowTicketConflict(error);
        }

        const previousIssues = existing.jiraIssues.map((issue) => ({
          key: issue.key,
          summary: issue.summary
        }));
        const nextIssues = (await loadTicketJiraIssueLinks(app, id)).map((issue) => ({
          key: issue.issueKey,
          summary: issue.issueSummary
        }));
        recordJiraIssueLinkChanges(app, id, previousIssues, nextIssues);
      }

      if (input.status && input.status !== existing.status) {
        recordActivity(app, id, "ticket.status.changed", `Status changed to ${input.status}`, {
          status: input.status
        });
      }

      if (input.priority && input.priority !== existing.priority) {
        recordActivity(app, id, "ticket.priority.changed", `Priority changed to ${input.priority}`);
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

      await replaceJiraIssueLinks(app, id, nextIssues);

      const changedCount = existing.jiraIssues.filter((issue) => {
        const nextSummary = refreshedByKey.get(normalizeJiraIssueKey(issue.key));
        return nextSummary !== undefined && nextSummary !== issue.summary;
      }).length;

      if (changedCount > 0) {
        recordActivity(
          app,
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

      return getTicketOrThrow(app, id);
    }
  );
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
  const { existing, archivableWorktrees, dirtyWorktrees } = prepared;

  if (existing.archivedAt) {
    logServerEvent(app, "info", "ticket.archive.skipped", {
      ticketId: existing.id,
      ticketKey: existing.key,
      reason: "already_archived"
    });
    return { ok: true };
  }

  if (dirtyWorktrees.length && !options?.force) {
    throw new AppError(
      409,
      "TICKET_ARCHIVE_DIRTY_WORKTREES",
      "One or more ticket worktrees have uncommitted changes",
      { dirtyWorktrees }
    );
  }

  for (const workspace of archivableWorktrees) {
    removeWorkspaceWorktree(workspace.worktreePath, {
      force: options?.force
    });
  }

  const archivedAt = nowIso();
  app.db
    .update(tickets)
    .set({
      archivedAt,
      updatedAt: archivedAt
    })
    .where(eq(tickets.id, existing.id))
    .run();
  recordActivity(app, existing.id, "ticket.archived", `Ticket ${existing.key} moved to history`);
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
      app.db
        .update(tickets)
        .set({
          archivedAt: null,
          updatedAt: restoredAt
        })
        .where(eq(tickets.id, existing.id))
        .run();
      recordActivity(app, existing.id, "ticket.unarchived", `Ticket ${existing.key} restored from history`);
      return { ok: true };
    }
  );
}

export async function saveTicketImage(app: FastifyInstance, ticketId: number, file: MultipartFile) {
  return withServerSpan(
    app,
    "ticket.image.upload",
    {
      ticketId,
      filename: file.filename,
      mimeType: file.mimetype
    },
    async () => {
      await getTicketOrThrow(app, ticketId);

      const extension = supportedTicketImageMimeTypes.get(file.mimetype);

      if (!extension) {
        throw new AppError(400, "UNSUPPORTED_TICKET_IMAGE_TYPE", "Only PNG, JPEG, GIF, and WebP images are supported");
      }

      const buffer = await file.toBuffer();

      if (!buffer.byteLength) {
        throw new AppError(400, "EMPTY_TICKET_IMAGE", "Image file is empty");
      }

      const ticketDirectory = getTicketUploadsDirectory(app, ticketId);
      await mkdir(ticketDirectory, { recursive: true });

      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizeFilenameSegment(file.filename)}.${extension}`;
      const targetPath = path.resolve(ticketDirectory, filename);
      await writeFile(targetPath, buffer);

      const alt = filenameToAltText(file.filename);
      const url = `/api/tickets/${ticketId}/images/${filename}`;

      logServerEvent(app, "info", "ticket.image.upload.persisted", {
        ticketId,
        filename,
        sizeBytes: buffer.byteLength
      });

      return {
        alt,
        filename,
        url,
        markdown: `![${escapeMarkdownText(alt)}](${url})`
      };
    }
  );
}

export async function streamTicketImage(app: FastifyInstance, ticketId: number, filename: string) {
  await getTicketOrThrow(app, ticketId);

  const imagePath = assertTicketImagePath(app, ticketId, filename);

  try {
    const imageStats = await stat(imagePath);

    if (!imageStats.isFile()) {
      throw new AppError(404, "TICKET_IMAGE_NOT_FOUND", "Ticket image not found");
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(404, "TICKET_IMAGE_NOT_FOUND", "Ticket image not found");
  }

  return {
    contentType: resolveTicketImageContentType(filename),
    stream: createReadStream(imagePath)
  };
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
  await ensureProjectsExist(app, [input.projectId]);

  try {
    const created = app.db
      .insert(ticketProjectLinks)
      .values({
        ticketId,
        projectId: input.projectId,
        relationship: input.relationship,
        createdAt: nowIso()
      })
      .returning()
      .get();

    const linkedProject = app.db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .get();

    app.db
      .update(tickets)
      .set({ updatedAt: nowIso() })
      .where(eq(tickets.id, ticketId))
      .run();

    recordActivity(
      app,
      ticketId,
      "ticket.project_linked",
      `${linkedProject?.name ?? `Project ${input.projectId}`} linked as ${input.relationship.toLowerCase()}`
    );

    return created;
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
    const created = app.db
      .insert(ticketJiraIssueLinks)
      .values({
        ticketId,
        issueKey: normalizeJiraIssueKey(input.key),
        issueSummary: normalizeJiraIssueSummary(input.summary),
        createdAt: nowIso()
      })
      .returning()
      .get();

    app.db
      .update(tickets)
      .set({ updatedAt: nowIso() })
      .where(eq(tickets.id, ticketId))
      .run();

    recordActivity(
      app,
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

  app.db.delete(ticketProjectLinks).where(eq(ticketProjectLinks.id, id)).run();
  app.db
    .update(tickets)
    .set({ updatedAt: nowIso() })
    .where(eq(tickets.id, existing.ticketId))
    .run();
  recordActivity(
    app,
    existing.ticketId,
    "ticket.project_unlinked",
    `${existing.project.name} removed from ticket`
  );
  return { ok: true };
}
