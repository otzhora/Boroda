import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ticketActivities, tickets, workContexts } from "../../db/schema";
import { AppError } from "../../shared/errors";

function nowIso() {
  return new Date().toISOString();
}

function logActivity(app: FastifyInstance, ticketId: number, type: string, message: string) {
  app.db.insert(ticketActivities).values({
    ticketId,
    type,
    message,
    metaJson: "{}",
    createdAt: nowIso()
  }).run();
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
  input: { type: string; label: string; value: string; meta: Record<string, unknown> }
) {
  getTicketOrThrow(app, ticketId);
  const timestamp = nowIso();
  const created = app.db
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

  logActivity(app, ticketId, "work-context.created", `Work context added: ${input.label}`);
  return created;
}

export async function updateWorkContext(
  app: FastifyInstance,
  id: number,
  input: Partial<{ type: string; label: string; value: string; meta: Record<string, unknown> }>
) {
  const existing = app.db
    .select()
    .from(workContexts)
    .where(eq(workContexts.id, id))
    .get();

  if (!existing) {
    throw new AppError(404, "WORK_CONTEXT_NOT_FOUND", "Work context not found");
  }

  const updated = app.db
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

  logActivity(app, existing.ticketId, "work-context.updated", `Work context updated: ${updated.label}`);
  return updated;
}

export async function deleteWorkContext(app: FastifyInstance, id: number) {
  const existing = app.db
    .select()
    .from(workContexts)
    .where(eq(workContexts.id, id))
    .get();

  if (!existing) {
    throw new AppError(404, "WORK_CONTEXT_NOT_FOUND", "Work context not found");
  }

  app.db.delete(workContexts).where(eq(workContexts.id, id)).run();
  logActivity(app, existing.ticketId, "work-context.deleted", `Work context removed: ${existing.label}`);
  return { ok: true };
}
