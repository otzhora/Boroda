import { createReadStream } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { getConfig } from "../../config";
import { getJiraIssuesByKeys } from "../integrations/jira/service";
import {
  projects,
  sequences,
  ticketActivities,
  ticketJiraIssueLinks,
  ticketProjectLinks,
  tickets,
  workContexts
} from "../../db/schema";
import { AppError } from "../../shared/errors";

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

async function removeTicketImageDirectory(app: FastifyInstance, ticketId: number) {
  await rm(getTicketUploadsDirectory(app, ticketId), { recursive: true, force: true });
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
  return app.db.query.ticketProjectLinks.findMany({
    where: eq(ticketProjectLinks.ticketId, ticketId),
    with: {
      project: {
        with: {
          folders: true
        }
      }
    }
  });
}

async function loadTicketJiraIssueLinks(app: FastifyInstance, ticketId: number) {
  return app.db.query.ticketJiraIssueLinks.findMany({
    where: eq(ticketJiraIssueLinks.ticketId, ticketId),
    orderBy: [asc(ticketJiraIssueLinks.id)]
  });
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
  filters: { status?: string; priority?: string; projectId?: number; q?: string }
) {
  const queryFilters = [sql`${tickets.archivedAt} is null`];

  if (filters.status) {
    queryFilters.push(eq(tickets.status, filters.status));
  }

  if (filters.priority) {
    queryFilters.push(eq(tickets.priority, filters.priority));
  }

  if (filters.q) {
    queryFilters.push(
      sql`(
        ${tickets.title} like ${`%${filters.q}%`}
        or ${tickets.description} like ${`%${filters.q}%`}
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

  if (filters.projectId) {
    const linked = app.db
      .select({ ticketId: ticketProjectLinks.ticketId })
      .from(ticketProjectLinks)
      .where(eq(ticketProjectLinks.projectId, filters.projectId))
      .all()
      .map((row) => row.ticketId);

    if (!linked.length) {
      return [];
    }

    queryFilters.push(inArray(tickets.id, linked));
  }

  return app.db
    .select()
    .from(tickets)
    .where(and(...queryFilters))
    .orderBy(desc(tickets.updatedAt))
    .all();
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
    jiraIssues: Array<{ key: string; summary: string }>;
    status: string;
    priority: string;
    dueAt?: string | null;
    projectLinks: Array<{ projectId: number; relationship: string }>;
  }
) {
  const now = nowIso();
  const key = nextTicketKey(app);
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
      branch: input.branch ?? null,
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
    await replaceJiraIssueLinks(app, ticket.id, input.jiraIssues);
  } catch (error) {
    app.db.delete(tickets).where(eq(tickets.id, ticket.id)).run();
    rethrowTicketConflict(error);
  }

  recordActivity(app, ticket.id, "ticket.created", `Ticket ${ticket.key} created`);
  recordProjectLinkChanges(app, ticket.id, [], await loadTicketProjectLinks(app, ticket.id));
  recordJiraIssueLinkChanges(app, ticket.id, [], input.jiraIssues);

  return getTicketOrThrow(app, ticket.id);
}

export async function updateTicket(
  app: FastifyInstance,
  id: number,
  input: Partial<{
    title: string;
    description: string;
    branch: string | null;
    jiraIssues: Array<{ key: string; summary: string }>;
    status: string;
    priority: string;
    dueAt: string | null;
    projectLinks: Array<{ projectId: number; relationship: string }>;
  }>
) {
  const existing = await getTicketOrThrow(app, id);
  const nextUpdatedAt = nowIso();

  const updated = app.db
    .update(tickets)
    .set({
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      branch: input.branch === undefined ? existing.branch : input.branch,
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
    recordActivity(app, id, "ticket.status.changed", `Status changed to ${input.status}`);
  }

  if (input.priority && input.priority !== existing.priority) {
    recordActivity(app, id, "ticket.priority.changed", `Priority changed to ${input.priority}`);
  }

  if (input.description !== undefined && input.description !== existing.description) {
    await cleanupTicketImages(app, id, input.description);
  }

  return getTicketOrThrow(app, updated.id);
}

export async function refreshTicketJiraIssues(app: FastifyInstance, id: number) {
  const existing = await getTicketOrThrow(app, id);

  if (!existing.jiraIssues.length) {
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

  return getTicketOrThrow(app, id);
}

export async function deleteTicket(app: FastifyInstance, id: number) {
  await getTicketOrThrow(app, id);
  app.db.delete(tickets).where(eq(tickets.id, id)).run();
  await removeTicketImageDirectory(app, id);
  return { ok: true };
}

export async function saveTicketImage(app: FastifyInstance, ticketId: number, file: MultipartFile) {
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

  return {
    alt,
    filename,
    url,
    markdown: `![${escapeMarkdownText(alt)}](${url})`
  };
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
