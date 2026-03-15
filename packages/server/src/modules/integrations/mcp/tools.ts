import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  appendAgentTicketActivity,
  createAgentTicket,
  createAgentWorkContext,
  getAgentTicket,
  listAgentProjects,
  listAgentTickets,
  updateAgentTicket
} from "../../agents/service";
import {
  mcpAppendActivitySchema,
  mcpAttachWorkContextSchema,
  mcpCreateTicketSchema,
  mcpGetTicketSchema,
  mcpListProjectsSchema,
  mcpListTicketsSchema,
  mcpUpdateTicketSchema
} from "./schemas";

export interface McpToolDefinition<TArgs extends z.ZodType = z.ZodType> {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  schema: TArgs;
  handler: (app: FastifyInstance, args: z.infer<TArgs>) => Promise<unknown>;
}

function objectSchema(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: "object",
    properties,
    additionalProperties: false,
    required
  };
}

const agentActorSchema = objectSchema({
  agentKind: { type: "string", minLength: 1 },
  sessionRef: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] }
});

const projectLinkSchema = objectSchema(
  {
    projectId: { type: "integer", minimum: 1 },
    relationship: {
      type: "string",
      enum: ["PRIMARY", "RELATED", "DEPENDENCY"]
    }
  },
  ["projectId", "relationship"]
);

const jiraIssueSchema = objectSchema(
  {
    key: { type: "string", minLength: 1 },
    summary: { type: "string" }
  },
  ["key"]
);

const workContextSchema = objectSchema(
  {
    type: {
      type: "string",
      enum: ["CODEX_SESSION", "CLAUDE_SESSION", "CURSOR_SESSION", "PR", "AWS_CONSOLE", "TERRAFORM_RUN", "MANUAL_UI", "LINK", "NOTE"]
    },
    label: { type: "string" },
    value: { type: "string" },
    meta: {
      type: "object",
      additionalProperties: true
    },
    actor: agentActorSchema
  },
  ["type", "label", "value"]
);

export const mcpToolDefinitions: McpToolDefinition[] = [
  {
    name: "boroda.list_projects",
    title: "List Boroda projects",
    description: "List Boroda projects that agents can link to tickets.",
    inputSchema: objectSchema({
      scope: {
        type: "string",
        enum: ["active", "archived", "all"],
        default: "active"
      }
    }),
    schema: mcpListProjectsSchema,
    async handler(app, args) {
      return {
        items: await listAgentProjects(app, args)
      };
    }
  },
  {
    name: "boroda.list_tickets",
    title: "List Boroda tickets",
    description: "List Boroda tickets through the agent-safe filter surface.",
    inputSchema: objectSchema({
      q: { type: "string" },
      scope: {
        type: "string",
        enum: ["active", "archived", "all"],
        default: "active"
      },
      status: {
        type: "array",
        items: { type: "string" },
        default: []
      },
      priority: {
        type: "array",
        items: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        },
        default: []
      },
      projectId: {
        type: "array",
        items: { type: "integer", minimum: 1 },
        default: []
      }
    }),
    schema: mcpListTicketsSchema,
    handler: listAgentTickets
  },
  {
    name: "boroda.get_ticket",
    title: "Get a Boroda ticket",
    description: "Load full ticket details before making agent-driven updates.",
    inputSchema: objectSchema({
      ticketId: { type: "integer", minimum: 1 }
    }, ["ticketId"]),
    schema: mcpGetTicketSchema,
    async handler(app, args) {
      return getAgentTicket(app, args.ticketId);
    }
  },
  {
    name: "boroda.create_ticket",
    title: "Create a Boroda ticket",
    description: "Create a Boroda ticket with optional project links, Jira links, and work context.",
    inputSchema: objectSchema({
      title: { type: "string", minLength: 1 },
      description: { type: "string", default: "" },
      status: { type: "string", default: "INBOX" },
      priority: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default: "MEDIUM"
      },
      branch: { anyOf: [{ type: "string" }, { type: "null" }] },
      dueAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
      projectLinks: { type: "array", items: projectLinkSchema, default: [] },
      jiraIssues: { type: "array", items: jiraIssueSchema, default: [] },
      workContexts: { type: "array", items: workContextSchema, default: [] },
      actor: agentActorSchema
    }, ["title"]),
    schema: mcpCreateTicketSchema,
    async handler(app, args) {
      return createAgentTicket(app, args, "mcp");
    }
  },
  {
    name: "boroda.update_ticket",
    title: "Update a Boroda ticket",
    description: "Update ticket fields through the same mutation semantics used by the app.",
    inputSchema: objectSchema({
      ticketId: { type: "integer", minimum: 1 },
      patch: objectSchema({
        title: { type: "string", minLength: 1 },
        description: { type: "string" },
        branch: { anyOf: [{ type: "string" }, { type: "null" }] },
        status: { type: "string", minLength: 1 },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        },
        dueAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] }
      }),
      actor: agentActorSchema
    }, ["ticketId", "patch"]),
    schema: mcpUpdateTicketSchema,
    async handler(app, args) {
      return updateAgentTicket(app, args.ticketId, {
        patch: args.patch,
        actor: args.actor
      }, "mcp");
    }
  },
  {
    name: "boroda.attach_work_context",
    title: "Attach Boroda work context",
    description: "Attach durable context to a ticket without changing core ticket fields.",
    inputSchema: objectSchema({
      ticketId: { type: "integer", minimum: 1 },
      type: workContextSchema.properties.type,
      label: { type: "string" },
      value: { type: "string" },
      meta: { type: "object", additionalProperties: true, default: {} },
      actor: agentActorSchema
    }, ["ticketId", "type", "label", "value"]),
    schema: mcpAttachWorkContextSchema,
    async handler(app, args) {
      return createAgentWorkContext(app, args.ticketId, {
        type: args.type,
        label: args.label,
        value: args.value,
        meta: args.meta,
        actor: args.actor
      }, "mcp");
    }
  },
  {
    name: "boroda.append_activity",
    title: "Append Boroda activity",
    description: "Append a ticket activity entry without changing ticket fields.",
    inputSchema: objectSchema({
      ticketId: { type: "integer", minimum: 1 },
      type: { type: "string", minLength: 1 },
      message: { type: "string", minLength: 1 },
      meta: { type: "object", additionalProperties: true, default: {} },
      actor: agentActorSchema
    }, ["ticketId", "type", "message"]),
    schema: mcpAppendActivitySchema,
    async handler(app, args) {
      return appendAgentTicketActivity(app, args.ticketId, {
        type: args.type,
        message: args.message,
        meta: args.meta,
        actor: args.actor
      }, "mcp");
    }
  }
];
