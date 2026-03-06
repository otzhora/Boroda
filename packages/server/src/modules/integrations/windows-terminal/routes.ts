import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ticketIdParamSchema } from "../../tickets/schemas";
import { openTicketInWindowsTerminal } from "./service";

const openTicketInWindowsTerminalBodySchema = z.object({
  folderId: z.number().int().positive().optional()
});

export const windowsTerminalRoutes: FastifyPluginAsync = async (app) => {
  app.post("/integrations/windows-terminal/tickets/:id/open", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    const body = openTicketInWindowsTerminalBodySchema.parse(request.body ?? {});
    return openTicketInWindowsTerminal(app, params.id, body);
  });
};
