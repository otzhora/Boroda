import type { FastifyPluginAsync } from "fastify";
import { ticketIdParamSchema } from "../../tickets/schemas";
import { openTicketInWindowsTerminal } from "./service";

export const windowsTerminalRoutes: FastifyPluginAsync = async (app) => {
  app.post("/integrations/windows-terminal/tickets/:id/open", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    return openTicketInWindowsTerminal(app, params.id);
  });
};
