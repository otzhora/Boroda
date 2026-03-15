import type { FastifyInstance } from "fastify";
import { DEFAULT_BOARD_COLUMNS, ensureBoardColumnsPresent } from "../board/columns";
import { workContextTypeSchema } from "../work-contexts/schemas";

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const DEFAULT_AGENT_TICKET_STATUS = DEFAULT_BOARD_COLUMNS[0].status;
export const DEFAULT_AGENT_TICKET_PRIORITY = "MEDIUM" as const;
export const WORK_CONTEXT_TYPES = workContextTypeSchema.options;

export async function getAgentMetadata(app: FastifyInstance) {
  const boardStatuses = await ensureBoardColumnsPresent(app);

  return {
    ticket: {
      defaults: {
        status: DEFAULT_AGENT_TICKET_STATUS,
        priority: DEFAULT_AGENT_TICKET_PRIORITY
      },
      priorities: [...TICKET_PRIORITIES],
      statuses: boardStatuses.map((column) => ({
        status: column.status,
        label: column.label,
        position: column.position
      }))
    },
    workContexts: {
      types: [...WORK_CONTEXT_TYPES]
    }
  };
}
