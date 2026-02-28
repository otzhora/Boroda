import type { FastifyPluginAsync } from "fastify";
import {
  createTicketProjectLinkSchema,
  createTicketSchema,
  ticketIdParamSchema,
  ticketProjectLinkIdParamSchema,
  ticketQuerySchema,
  updateTicketSchema
} from "./schemas";
import {
  addTicketProjectLink,
  createTicket,
  deleteTicket,
  deleteTicketProjectLink,
  getTicketOrThrow,
  listTickets,
  updateTicket
} from "./service";

export const ticketRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tickets", async (request) => {
    const query = ticketQuerySchema.parse(request.query);
    return listTickets(app, query);
  });

  app.post("/tickets", async (request) => {
    const payload = createTicketSchema.parse(request.body);
    return createTicket(app, payload);
  });

  app.get("/tickets/:id", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    return getTicketOrThrow(app, params.id);
  });

  app.patch("/tickets/:id", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    const payload = updateTicketSchema.parse(request.body);
    return updateTicket(app, params.id, payload);
  });

  app.delete("/tickets/:id", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    return deleteTicket(app, params.id);
  });

  app.post("/tickets/:id/projects", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    const payload = createTicketProjectLinkSchema.parse(request.body);
    return addTicketProjectLink(app, params.id, payload);
  });

  app.delete("/ticket-project-links/:id", async (request) => {
    const params = ticketProjectLinkIdParamSchema.parse(request.params);
    return deleteTicketProjectLink(app, params.id);
  });
};
