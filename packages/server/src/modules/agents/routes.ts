import type { FastifyPluginAsync } from "fastify";
import { listProjects } from "../projects/service";
import { appendTicketActivity, createTicket, getTicketOrThrow, listTickets, updateTicket } from "../tickets/service";
import { createWorkContext } from "../work-contexts/service";
import {
  agentAppendActivitySchema,
  type AgentActorInput,
  agentCreateTicketSchema,
  agentCreateWorkContextSchema,
  agentProjectQuerySchema,
  agentTicketIdParamSchema,
  agentTicketQuerySchema,
  agentUpdateTicketSchema
} from "./schemas";

function toActivityActor(actor?: AgentActorInput) {
  if (!actor) {
    return undefined;
  }

  return {
    actorType: "agent" as const,
    agentKind: actor.agentKind,
    sessionRef: actor.sessionRef ?? null,
    transport: "http" as const
  };
}

export const agentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agents/projects", async (request) => {
    const query = agentProjectQuerySchema.parse(request.query);
    return listProjects(app, query);
  });

  app.get("/agents/tickets", async (request) => {
    const query = agentTicketQuerySchema.parse(request.query);
    return listTickets(app, {
      ...query,
      jiraIssue: [],
      sort: "updated",
      dir: "desc"
    });
  });

  app.get("/agents/tickets/:id", async (request) => {
    const params = agentTicketIdParamSchema.parse(request.params);
    return getTicketOrThrow(app, params.id);
  });

  app.post("/agents/tickets", async (request) => {
    const payload = agentCreateTicketSchema.parse(request.body);
    return createTicket(
      app,
      {
        title: payload.title,
        description: payload.description,
        workContexts: payload.workContexts,
        branch: payload.branch,
        jiraIssues: payload.jiraIssues,
        status: payload.status,
        priority: payload.priority,
        dueAt: payload.dueAt,
        projectLinks: payload.projectLinks
      },
      {
        actor: toActivityActor(payload.actor)
      }
    );
  });

  app.patch("/agents/tickets/:id", async (request) => {
    const params = agentTicketIdParamSchema.parse(request.params);
    const payload = agentUpdateTicketSchema.parse(request.body);
    return updateTicket(app, params.id, payload.patch, {
      actor: toActivityActor(payload.actor)
    });
  });

  app.post("/agents/tickets/:id/contexts", async (request) => {
    const params = agentTicketIdParamSchema.parse(request.params);
    const payload = agentCreateWorkContextSchema.parse(request.body);
    return createWorkContext(
      app,
      params.id,
      {
        type: payload.type,
        label: payload.label,
        value: payload.value,
        meta: payload.meta
      },
      {
        actor: toActivityActor(payload.actor)
      }
    );
  });

  app.post("/agents/tickets/:id/activity", async (request) => {
    const params = agentTicketIdParamSchema.parse(request.params);
    const payload = agentAppendActivitySchema.parse(request.body);
    return appendTicketActivity(
      app,
      params.id,
      {
        type: payload.type,
        message: payload.message,
        meta: payload.meta
      },
      {
        actor: toActivityActor(payload.actor)
      }
    );
  });
};
