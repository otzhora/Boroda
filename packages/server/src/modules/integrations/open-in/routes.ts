import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ticketIdParamSchema } from "../../tickets/schemas";
import { openTicketInApp } from "./service";

const openTicketInAppBodySchema = z.object({
  target: z.enum(["explorer", "vscode", "cursor", "terminal"]),
  mode: z.enum(["folder", "worktree"]).default("worktree"),
  folderId: z.number().int().positive().optional(),
  workspaceId: z.number().int().positive().optional(),
  runSetup: z.boolean().default(true)
});

export const openInRoutes: FastifyPluginAsync = async (app) => {
  app.post("/integrations/open-in/tickets/:id/open", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    const body = openTicketInAppBodySchema.parse(request.body ?? {});
    return openTicketInApp(app, params.id, body);
  });
};
