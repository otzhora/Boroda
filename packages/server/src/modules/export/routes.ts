import type { FastifyPluginAsync } from "fastify";
import { importWorkspaceSchema } from "./schemas";
import { exportWorkspace, importWorkspace } from "./service";

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/export", async (_request, reply) => {
    const snapshot = await exportWorkspace(app);

    reply.header("content-type", "application/json; charset=utf-8");
    reply.header(
      "content-disposition",
      `attachment; filename="boroda-export-${snapshot.exportedAt.slice(0, 10)}.json"`
    );

    return snapshot;
  });

  app.post("/import", async (request) => {
    const payload = importWorkspaceSchema.parse(request.body);
    return importWorkspace(app, payload);
  });
};
