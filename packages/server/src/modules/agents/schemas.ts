import { z } from "zod";
import { projectQuerySchema } from "../projects/schemas";
import { createTicketSchema, ticketIdParamSchema } from "../tickets/schemas";
import { createWorkContextSchema } from "../work-contexts/schemas";

function toArray(value: unknown) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

const agentActorSchema = z.object({
  agentKind: z.string().trim().min(1),
  sessionRef: z.string().trim().min(1).nullable().optional()
});

export const agentProjectQuerySchema = projectQuerySchema;
export const agentMetadataSchema = z.object({}).strict();

export const agentTicketQuerySchema = z.object({
  q: z.string().trim().optional(),
  scope: z.enum(["active", "archived", "all"]).default("active"),
  status: z.preprocess((value) => toArray(value), z.array(z.string().trim().min(1).max(64)).default([])),
  priority: z.preprocess(
    (value) => toArray(value),
    z.array(z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])).default([])
  ),
  projectId: z.preprocess(
    (value) => toArray(value),
    z.array(z.coerce.number().int().positive()).default([])
  )
});

export const agentTicketIdParamSchema = ticketIdParamSchema;

export const agentCreateTicketSchema = createTicketSchema
  .omit({
    workspaces: true
  })
  .extend({
    actor: agentActorSchema.optional()
  })
  .strict();

export const agentUpdateTicketSchema = z.object({
  actor: agentActorSchema.optional(),
  patch: z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      branch: z
        .string()
        .trim()
        .transform((value) => (value.length ? value : null))
        .nullable()
        .optional(),
      status: z.string().trim().min(1).max(64).optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
      dueAt: z.string().datetime().nullable().optional()
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "At least one field must be provided")
}).strict();

export const agentCreateWorkContextSchema = createWorkContextSchema.extend({
  actor: agentActorSchema.optional()
}).strict();

export const agentAppendActivitySchema = z.object({
  actor: agentActorSchema.optional(),
  type: z.string().trim().min(1),
  message: z.string().trim().min(1),
  meta: z.record(z.unknown()).default({})
}).strict();

export type AgentActorInput = z.infer<typeof agentActorSchema>;
