import { z } from "zod";

const statusEnum = z.enum([
  "INBOX",
  "READY",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "MANUAL_UI",
  "DONE"
]);

const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const relationshipEnum = z.enum(["PRIMARY", "RELATED", "DEPENDENCY"]);

export const ticketIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const ticketProjectLinkIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const ticketQuerySchema = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  projectId: z.coerce.number().int().positive().optional(),
  q: z.string().optional()
});

export const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  status: statusEnum.default("INBOX"),
  priority: priorityEnum.default("MEDIUM"),
  dueAt: z.string().datetime().optional().nullable(),
  projectLinks: z
    .array(
      z.object({
        projectId: z.number().int().positive(),
        relationship: relationshipEnum
      })
    )
    .default([])
});

export const createTicketProjectLinkSchema = z.object({
  projectId: z.number().int().positive(),
  relationship: relationshipEnum
});

export const updateTicketSchema = createTicketSchema
  .omit({ projectLinks: true })
  .partial()
  .extend({
    projectLinks: createTicketSchema.shape.projectLinks.optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");
