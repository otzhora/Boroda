import { z } from "zod";

const statusField = z.string().trim().min(1).max(64);

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

function toArray(value: unknown) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export const ticketIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const archiveTicketQuerySchema = z.object({
  force: z.coerce.boolean().optional().default(false)
});

export const ticketProjectLinkIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const ticketQuerySchema = z.object({
  status: z.preprocess((value) => toArray(value), z.array(statusField).default([])),
  priority: z.preprocess((value) => toArray(value), z.array(priorityEnum).default([])),
  projectId: z.preprocess(
    (value) => toArray(value),
    z.array(z.coerce.number().int().positive()).default([])
  ),
  q: z.string().optional(),
  jiraIssue: z.preprocess((value) => toArray(value), z.array(z.string().trim().min(1)).default([])),
  scope: z.enum(["active", "archived", "all"]).default("active"),
  sort: z.enum(["ticket", "jira", "status", "priority", "projects", "updated"]).default("updated"),
  dir: z.enum(["asc", "desc"]).default("desc")
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
  status: statusField.default("INBOX"),
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
