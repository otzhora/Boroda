import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { ticketActivities, tickets, workContexts } from "../../db/schema";
import { AppError } from "../../shared/errors";

function nowIso() {
  return new Date().toISOString();
}

type AppDb = FastifyInstance["db"];
type TransactionCallback = Parameters<AppDb["transaction"]>[0];
type DbTransaction = TransactionCallback extends (tx: infer Tx, ...args: never[]) => unknown ? Tx : never;
type DbExecutor = AppDb | DbTransaction;

function logActivity(db: DbExecutor, ticketId: number, type: string, message: string) {
  db.insert(ticketActivities).values({
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

    logActivity(tx, ticketId, "work-context.created", `Work context added: ${input.label}`);
    return created;
  });
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

    logActivity(tx, existing.ticketId, "work-context.updated", `Work context updated: ${updated.label}`);
    return updated;
  });
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

  app.db.transaction((tx) => {
    tx.delete(workContexts).where(eq(workContexts.id, id)).run();
    logActivity(tx, existing.ticketId, "work-context.deleted", `Work context removed: ${existing.label}`);
  });
  return { ok: true };
}
