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
const optionalTicketTextField = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional();

const workspaceRoleField = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .default("primary");

const workspaceSchema = z.object({
  id: z.number().int().positive().optional(),
  projectFolderId: z.number().int().positive(),
  branchName: z.string().trim().min(1),
  baseBranch: optionalTicketTextField,
  role: workspaceRoleField
});

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
  branch: optionalTicketTextField,
  workspaces: z.array(workspaceSchema).default([]),
  jiraIssues: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        summary: z.string().trim().default("")
      })
    )
    .default([]),
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

export const createTicketJiraIssueLinkSchema = z.object({
  key: z.string().trim().min(1),
  summary: z.string().trim().default("")
});

export const updateTicketSchema = createTicketSchema
  .omit({ projectLinks: true })
  .partial()
  .extend({
    projectLinks: createTicketSchema.shape.projectLinks.optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");
