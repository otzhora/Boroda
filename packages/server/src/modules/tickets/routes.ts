import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../shared/errors";
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
  saveTicketImage,
  streamTicketImage,
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

  app.post("/tickets/:id/images", async (request) => {
    const params = ticketIdParamSchema.parse(request.params);
    const image = await request.file({
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024
      }
    });

    if (!image) {
      throw new AppError(400, "TICKET_IMAGE_REQUIRED", "Image file is required");
    }

    return saveTicketImage(app, params.id, image);
  });

  app.get("/tickets/:id/images/:filename", async (request, reply) => {
    const params = request.params as { id: string; filename: string };
    const ticketId = ticketIdParamSchema.parse({ id: params.id }).id;
    const { contentType, stream } = await streamTicketImage(app, ticketId, params.filename);
    reply.header("cache-control", "no-store");
    return reply.type(contentType).send(stream);
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
