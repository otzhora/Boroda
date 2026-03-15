import type { FastifyInstance } from "fastify";
import { ticketActivities } from "../../../db/schema";

function nowIso() {
  return new Date().toISOString();
}

export function recordTicketActivity(
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
