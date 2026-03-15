import fs from "node:fs";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { agentRoutes } from "./modules/agents/routes";
import { boardRoutes } from "./modules/board/routes";
import { getConfig } from "./config";
import { exportRoutes } from "./modules/export/routes";
import { fsRoutes } from "./modules/fs/routes";
import { healthRoutes } from "./modules/health/routes";
import { jiraRoutes } from "./modules/integrations/jira/routes";
import { openInRoutes } from "./modules/integrations/open-in/routes";
import { projectRoutes } from "./modules/projects/routes";
import { ticketRoutes } from "./modules/tickets/routes";
import { workContextRoutes } from "./modules/work-contexts/routes";
import { dbPlugin } from "./plugins/db";
import { toErrorPayload } from "./shared/errors";
import { logServerError, logServerEvent } from "./shared/observability";

declare module "fastify" {
  interface FastifyRequest {
    borodaRequestStartedAt?: bigint;
  }
}

export function buildApp() {
  const config = getConfig();
  const app = Fastify({
    logger: true,
    disableRequestLogging: true
  });

  app.addHook("onRequest", async (request) => {
    request.borodaRequestStartedAt = process.hrtime.bigint();
  });

  if (config.requestLoggingEnabled) {
    app.addHook("onRequest", async (request) => {
      logServerEvent(request.log, "info", "http.request.started", {
        requestId: request.id,
        method: request.method,
        url: request.url
      });
    });

    app.addHook("onResponse", async (request, reply) => {
      const startedAt = request.borodaRequestStartedAt;
      const durationMs = startedAt ? Number(process.hrtime.bigint() - startedAt) / 1_000_000 : undefined;

      logServerEvent(request.log, "info", "http.request.completed", {
        requestId: request.id,
        method: request.method,
        route: request.routeOptions.url,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs
      });
    });
  }

  app.register(dbPlugin);
  app.register(fastifyMultipart, {
    limits: {
      files: 1
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const { statusCode, payload } = toErrorPayload(error);
    const startedAt = request.borodaRequestStartedAt;
    const durationMs = startedAt ? Number(process.hrtime.bigint() - startedAt) / 1_000_000 : undefined;

    logServerError(request.log, "http.request.failed", error, {
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url,
      url: request.url,
      statusCode,
      durationMs,
      errorCode: payload.error.code
    });

    reply.status(statusCode).send(payload);
  });

  app.register(async (api) => {
    api.register(healthRoutes);
    api.register(agentRoutes);
    api.register(projectRoutes);
    api.register(ticketRoutes);
    api.register(boardRoutes);
    api.register(workContextRoutes);
    api.register(fsRoutes);
    api.register(exportRoutes);
    api.register(jiraRoutes);
    api.register(openInRoutes);
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

  logServerEvent(app, "info", "app.initialized", {
    webDistPath: config.webDistPath,
    servesStaticApp: fs.existsSync(config.webDistPath)
  });

  return app;
}
