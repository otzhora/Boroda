import { z } from "zod";

const projectSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  color: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const projectFolderSchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  label: z.string(),
  path: z.string(),
  kind: z.enum(["APP", "BACKEND", "TERRAFORM", "INFRA", "DOCS", "OTHER"]),
  isPrimary: z.boolean(),
  existsOnDisk: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const ticketSchema = z.object({
  id: z.number().int().positive(),
  key: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["INBOX", "READY", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "MANUAL_UI", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  type: z.enum(["TASK", "BUG", "CHORE", "REVIEW", "MANUAL"]),
  dueAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable()
});

const ticketProjectLinkSchema = z.object({
  id: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  relationship: z.enum(["PRIMARY", "RELATED", "DEPENDENCY"]),
  createdAt: z.string()
});

const workContextSchema = z.object({
  id: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  type: z.enum([
    "CODEX_SESSION",
    "CLAUDE_SESSION",
    "CURSOR_SESSION",
    "PR",
    "AWS_CONSOLE",
    "TERRAFORM_RUN",
    "MANUAL_UI",
    "LINK",
    "NOTE"
  ]),
  label: z.string(),
  value: z.string(),
  metaJson: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const ticketActivitySchema = z.object({
  id: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  type: z.string(),
  message: z.string(),
  metaJson: z.string(),
  createdAt: z.string()
});

const sequenceSchema = z.object({
  name: z.string(),
  value: z.number().int().nonnegative()
});

export const importWorkspaceSchema = z.object({
  replaceExisting: z.boolean().default(false),
  snapshot: z.object({
    exportedAt: z.string(),
    data: z.object({
      sequences: z.array(sequenceSchema),
      projects: z.array(projectSchema),
      projectFolders: z.array(projectFolderSchema),
      tickets: z.array(ticketSchema),
      ticketProjectLinks: z.array(ticketProjectLinkSchema),
      workContexts: z.array(workContextSchema),
      ticketActivities: z.array(ticketActivitySchema)
    })
  })
});
