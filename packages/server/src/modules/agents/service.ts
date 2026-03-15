import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ActivityTransport } from "../../shared/types";
import { listProjects } from "../projects/service";
import { appendTicketActivity, createTicket, getTicketOrThrow, listTickets, updateTicket } from "../tickets/service";
import { createWorkContext } from "../work-contexts/service";
import type {
  AgentActorInput,
  agentAppendActivitySchema,
  agentCreateTicketSchema,
  agentCreateWorkContextSchema,
  agentProjectQuerySchema,
  agentTicketQuerySchema,
  agentUpdateTicketSchema
} from "./schemas";

type AgentProjectQuery = z.infer<typeof agentProjectQuerySchema>;
type AgentTicketQuery = z.infer<typeof agentTicketQuerySchema>;
type AgentCreateTicketInput = z.infer<typeof agentCreateTicketSchema>;
type AgentUpdateTicketInput = z.infer<typeof agentUpdateTicketSchema>;
type AgentCreateWorkContextInput = z.infer<typeof agentCreateWorkContextSchema>;
type AgentAppendActivityInput = z.infer<typeof agentAppendActivitySchema>;

export function toActivityActor(actor: AgentActorInput | undefined, transport: ActivityTransport) {
  if (!actor) {
    return undefined;
  }

  return {
    actorType: "agent" as const,
    agentKind: actor.agentKind,
    sessionRef: actor.sessionRef ?? null,
    transport
  };
}

export async function listAgentProjects(app: FastifyInstance, query: AgentProjectQuery) {
  return listProjects(app, query);
}

export async function listAgentTickets(app: FastifyInstance, query: AgentTicketQuery) {
  return listTickets(app, {
    ...query,
    jiraIssue: [],
    sort: "updated",
    dir: "desc"
  });
}

export async function getAgentTicket(app: FastifyInstance, ticketId: number) {
  return getTicketOrThrow(app, ticketId);
}

export async function createAgentTicket(
  app: FastifyInstance,
  payload: AgentCreateTicketInput,
  transport: ActivityTransport
) {
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
      actor: toActivityActor(payload.actor, transport)
    }
  );
}

export async function updateAgentTicket(
  app: FastifyInstance,
  ticketId: number,
  payload: AgentUpdateTicketInput,
  transport: ActivityTransport
) {
  return updateTicket(app, ticketId, payload.patch, {
    actor: toActivityActor(payload.actor, transport)
  });
}

export async function createAgentWorkContext(
  app: FastifyInstance,
  ticketId: number,
  payload: AgentCreateWorkContextInput,
  transport: ActivityTransport
) {
  return createWorkContext(
    app,
    ticketId,
    {
      type: payload.type,
      label: payload.label,
      value: payload.value,
      meta: payload.meta
    },
    {
      actor: toActivityActor(payload.actor, transport)
    }
  );
}

export async function appendAgentTicketActivity(
  app: FastifyInstance,
  ticketId: number,
  payload: AgentAppendActivityInput,
  transport: ActivityTransport
) {
  return appendTicketActivity(
    app,
    ticketId,
    {
      type: payload.type,
      message: payload.message,
      meta: payload.meta
    },
    {
      actor: toActivityActor(payload.actor, transport)
    }
  );
}
