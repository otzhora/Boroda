import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getBoard } from "./service";

const boardQuerySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  q: z.string().optional()
});

export const boardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/board", async (request) => {
    const query = boardQuerySchema.parse(request.query);
    return getBoard(app, query);
  });
};

