import type { FastifyInstance } from "fastify";
import {
  projectFolders,
  projects,
  sequences,
  ticketActivities,
  ticketProjectLinks,
  tickets,
  workContexts
} from "../../db/schema";
import { AppError } from "../../shared/errors";

export async function exportWorkspace(app: FastifyInstance) {
  return {
    exportedAt: new Date().toISOString(),
    data: {
      sequences: app.db.select().from(sequences).all(),
      projects: app.db.select().from(projects).all(),
      projectFolders: app.db.select().from(projectFolders).all(),
      tickets: app.db.select().from(tickets).all(),
      ticketProjectLinks: app.db.select().from(ticketProjectLinks).all(),
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
  payload: {
    replaceExisting: boolean;
    snapshot: Awaited<ReturnType<typeof exportWorkspace>>;
  }
) {
  if (!payload.replaceExisting && workspaceHasData(app)) {
    throw new AppError(
      409,
      "IMPORT_REQUIRES_REPLACE",
      "Workspace already contains data. Re-run import with replacement enabled."
    );
  }

  const { data } = payload.snapshot;

  app.db.transaction((tx) => {
    tx.delete(ticketActivities).run();
    tx.delete(workContexts).run();
    tx.delete(ticketProjectLinks).run();
    tx.delete(tickets).run();
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

    if (data.tickets.length) {
      tx.insert(tickets).values(data.tickets).run();
    }

    if (data.ticketProjectLinks.length) {
      tx.insert(ticketProjectLinks).values(data.ticketProjectLinks).run();
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
      workContexts: data.workContexts.length,
      ticketActivities: data.ticketActivities.length
    }
  };
}
