import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  projects,
  sequences,
  ticketActivities,
  ticketProjectLinks,
  tickets,
  workContexts
} from "../../db/schema";
import { AppError } from "../../shared/errors";

function nowIso() {
  return new Date().toISOString();
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
    queryFilters.push(or(like(tickets.title, `%${filters.q}%`), like(tickets.description, `%${filters.q}%`))!);
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

  const relatedWorkContexts = app.db
    .select()
    .from(workContexts)
    .where(eq(workContexts.ticketId, id))
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
    workContexts: relatedWorkContexts,
    activities
  };
}

export async function createTicket(
  app: FastifyInstance,
  input: {
    title: string;
    description: string;
    status: string;
    priority: string;
    type: string;
    dueAt?: string | null;
    projectLinks: Array<{ projectId: number; relationship: string }>;
  }
) {
  const now = nowIso();
  const key = nextTicketKey(app);
  assertUniqueProjectLinks(input.projectLinks);
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
      status: input.status,
      priority: input.priority,
      type: input.type,
      dueAt: input.dueAt ?? null,
      createdAt: now,
      updatedAt: now
    })
    .returning()
    .get();

  try {
    await replaceProjectLinks(app, ticket.id, input.projectLinks);
  } catch (error) {
    app.db.delete(tickets).where(eq(tickets.id, ticket.id)).run();
    rethrowTicketConflict(error);
  }

  recordActivity(app, ticket.id, "ticket.created", `Ticket ${ticket.key} created`);

  return getTicketOrThrow(app, ticket.id);
}

export async function updateTicket(
  app: FastifyInstance,
  id: number,
  input: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    type: string;
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
      status: input.status ?? existing.status,
      priority: input.priority ?? existing.priority,
      type: input.type ?? existing.type,
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

  if (input.status && input.status !== existing.status) {
    recordActivity(app, id, "ticket.status.changed", `Status changed to ${input.status}`);
  }

  if (input.priority && input.priority !== existing.priority) {
    recordActivity(app, id, "ticket.priority.changed", `Priority changed to ${input.priority}`);
  }

  return getTicketOrThrow(app, updated.id);
}

export async function deleteTicket(app: FastifyInstance, id: number) {
  await getTicketOrThrow(app, id);
  app.db.delete(tickets).where(eq(tickets.id, id)).run();
  return { ok: true };
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
