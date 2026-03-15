import { z } from "zod";
import {
  agentAppendActivitySchema,
  agentCreateTicketSchema,
  agentCreateWorkContextSchema,
  agentProjectQuerySchema,
  agentTicketQuerySchema,
  agentUpdateTicketSchema
} from "../../agents/schemas";

export const mcpListProjectsSchema = agentProjectQuerySchema.default({
  scope: "active"
});

export const mcpListTicketsSchema = agentTicketQuerySchema.default({
  q: undefined,
  scope: "active",
  status: [],
  priority: [],
  projectId: []
});

export const mcpGetTicketSchema = z.object({
  ticketId: z.coerce.number().int().positive()
}).strict();

export const mcpCreateTicketSchema = agentCreateTicketSchema;

export const mcpUpdateTicketSchema = z.object({
  ticketId: z.coerce.number().int().positive(),
  patch: agentUpdateTicketSchema.shape.patch,
  actor: agentUpdateTicketSchema.shape.actor
}).strict();

export const mcpAttachWorkContextSchema = z.object({
  ticketId: z.coerce.number().int().positive(),
  type: agentCreateWorkContextSchema.shape.type,
  label: agentCreateWorkContextSchema.shape.label,
  value: agentCreateWorkContextSchema.shape.value,
  meta: agentCreateWorkContextSchema.shape.meta,
  actor: agentCreateWorkContextSchema.shape.actor
}).strict();

export const mcpAppendActivitySchema = z.object({
  ticketId: z.coerce.number().int().positive(),
  type: agentAppendActivitySchema.shape.type,
  message: agentAppendActivitySchema.shape.message,
  meta: agentAppendActivitySchema.shape.meta,
  actor: agentAppendActivitySchema.shape.actor
}).strict();
