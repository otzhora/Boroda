import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { tickets, workContexts } from "../../db/schema";
import { AppError } from "../../shared/errors";
import type { ActivityWriteOptions } from "../../shared/types";
import { recordActivity } from "../tickets/service/activity";

function nowIso() {
  return new Date().toISOString();
}

function getTicketOrThrow(app: FastifyInstance, ticketId: number) {
  const ticket = app.db
    .select({ id: tickets.id })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .get();

  if (!ticket) {
    throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  }
}

export async function createWorkContext(
  app: FastifyInstance,
  ticketId: number,
  input: { type: string; label: string; value: string; meta: Record<string, unknown> },
  options: ActivityWriteOptions = {}
) {
  getTicketOrThrow(app, ticketId);
  const timestamp = nowIso();
  return app.db.transaction((tx) => {
    const created = tx
      .insert(workContexts)
      .values({
        ticketId,
        type: input.type,
        label: input.label,
        value: input.value,
        metaJson: JSON.stringify(input.meta),
        createdAt: timestamp,
        updatedAt: timestamp
      })
      .returning()
      .get();

    recordActivity(
      tx,
      ticketId,
      "work-context.created",
      `Work context added: ${input.label}`,
      {},
      options.actor
    );
    return created;
  });
}

export async function updateWorkContext(
  app: FastifyInstance,
  id: number,
  input: Partial<{ type: string; label: string; value: string; meta: Record<string, unknown> }>,
  options: ActivityWriteOptions = {}
) {
  const existing = app.db
    .select()
    .from(workContexts)
    .where(eq(workContexts.id, id))
    .get();

  if (!existing) {
    throw new AppError(404, "WORK_CONTEXT_NOT_FOUND", "Work context not found");
  }

  return app.db.transaction((tx) => {
    const updated = tx
      .update(workContexts)
      .set({
        type: input.type ?? existing.type,
        label: input.label ?? existing.label,
        value: input.value ?? existing.value,
        metaJson: JSON.stringify(input.meta ?? JSON.parse(existing.metaJson)),
        updatedAt: nowIso()
      })
      .where(eq(workContexts.id, id))
      .returning()
      .get();

    recordActivity(
      tx,
      existing.ticketId,
      "work-context.updated",
      `Work context updated: ${updated.label}`,
      {},
      options.actor
    );
    return updated;
  });
}

export async function deleteWorkContext(
  app: FastifyInstance,
  id: number,
  options: ActivityWriteOptions = {}
) {
  const existing = app.db
    .select()
    .from(workContexts)
    .where(eq(workContexts.id, id))
    .get();

  if (!existing) {
    throw new AppError(404, "WORK_CONTEXT_NOT_FOUND", "Work context not found");
  }

  app.db.transaction((tx) => {
    tx.delete(workContexts).where(eq(workContexts.id, id)).run();
    recordActivity(
      tx,
      existing.ticketId,
      "work-context.deleted",
      `Work context removed: ${existing.label}`,
      {},
      options.actor
    );
  });
  return { ok: true };
}
