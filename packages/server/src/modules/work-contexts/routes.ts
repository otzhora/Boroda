import type { FastifyPluginAsync } from "fastify";
import {
  createWorkContextSchema,
  ticketIdParamSchema,
  updateWorkContextSchema,
  workContextIdParamSchema
} from "./schemas";
import { createWorkContext, deleteWorkContext, updateWorkContext } from "./service";

export const workContextRoutes: FastifyPluginAsync = async (app) => {
  app.post("/tickets/:id/contexts", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    const payload = createWorkContextSchema.parse(request.body);
    return createWorkContext(app, params.id, payload);
  });

  app.patch("/work-contexts/:id", async (request) => {
    const params = workContextIdParamSchema.parse(request.params);
    const payload = updateWorkContextSchema.parse(request.body);
    return updateWorkContext(app, params.id, payload);
  });

  app.delete("/work-contexts/:id", async (request) => {
    const params = workContextIdParamSchema.parse(request.params);
    return deleteWorkContext(app, params.id);
  });
};

