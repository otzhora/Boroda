import fs from "node:fs";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { boardRoutes } from "./modules/board/routes";
import { getConfig } from "./config";
import { exportRoutes } from "./modules/export/routes";
import { fsRoutes } from "./modules/fs/routes";
import { healthRoutes } from "./modules/health/routes";
import { windowsTerminalRoutes } from "./modules/integrations/windows-terminal/routes";
import { projectRoutes } from "./modules/projects/routes";
import { ticketRoutes } from "./modules/tickets/routes";
import { workContextRoutes } from "./modules/work-contexts/routes";
import { dbPlugin } from "./plugins/db";
import { toErrorPayload } from "./shared/errors";

export function buildApp() {
  const config = getConfig();
  const app = Fastify({
    logger: true
  });

  app.register(dbPlugin);

  app.setErrorHandler((error, _request, reply) => {
    const { statusCode, payload } = toErrorPayload(error);
    reply.status(statusCode).send(payload);
  });

  app.register(async (api) => {
    api.register(healthRoutes);
    api.register(projectRoutes);
    api.register(ticketRoutes);
    api.register(boardRoutes);
    api.register(workContextRoutes);
    api.register(fsRoutes);
    api.register(exportRoutes);
    api.register(windowsTerminalRoutes);
  }, { prefix: "/api" });

  if (fs.existsSync(config.webDistPath)) {
    app.register(fastifyStatic, {
      root: config.webDistPath,
      prefix: "/"
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api")) {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "Route not found",
            details: {}
          }
        });
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        return reply.status(404).send({
          error: {
            code: "NOT_FOUND",
            message: "Route not found",
            details: {}
          }
        });
      }

      return reply.sendFile("index.html");
    });
  }

  return app;
}
