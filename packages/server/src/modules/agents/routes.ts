import type { FastifyPluginAsync } from "fastify";
import {
  appendAgentTicketActivity,
  createAgentTicket,
  createAgentWorkContext,
  getAgentTicket,
  listAgentProjects,
  listAgentTickets,
  updateAgentTicket
} from "./service";
import {
  agentAppendActivitySchema,
  agentCreateTicketSchema,
  agentCreateWorkContextSchema,
  agentProjectQuerySchema,
  agentTicketIdParamSchema,
  agentTicketQuerySchema,
  agentUpdateTicketSchema
} from "./schemas";

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agents/projects", async (request) => {
    const query = agentProjectQuerySchema.parse(request.query);
    return listAgentProjects(app, query);
  });

  app.get("/agents/tickets", async (request) => {
    const query = agentTicketQuerySchema.parse(request.query);
    return listAgentTickets(app, query);
  });

  app.get("/agents/tickets/:id", async (request) => {
    const params = agentTicketIdParamSchema.parse(request.params);
    return getAgentTicket(app, params.id);
  });

  app.post("/agents/tickets", async (request) => {
    const payload = agentCreateTicketSchema.parse(request.body);
    return createAgentTicket(app, payload, "http");
  });

  app.patch("/agents/tickets/:id", async (request) => {
    const params = agentTicketIdParamSchema.parse(request.params);
    const payload = agentUpdateTicketSchema.parse(request.body);
    return updateAgentTicket(app, params.id, payload, "http");
  });

  app.post("/agents/tickets/:id/contexts", async (request) => {
    const params = agentTicketIdParamSchema.parse(request.params);
    const payload = agentCreateWorkContextSchema.parse(request.body);
    return createAgentWorkContext(app, params.id, payload, "http");
  });

  app.post("/agents/tickets/:id/activity", async (request) => {
    const params = agentTicketIdParamSchema.parse(request.params);
    const payload = agentAppendActivitySchema.parse(request.body);
    return appendAgentTicketActivity(app, params.id, payload, "http");
  });
};
