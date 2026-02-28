import type { FastifyPluginAsync } from "fastify";
import { validatePathSchema } from "./schemas";
import { validatePath } from "./service";

export const fsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/fs/validate-path", async (request) => {
    const payload = validatePathSchema.parse(request.body);
    return validatePath(payload.path);
  });
};

