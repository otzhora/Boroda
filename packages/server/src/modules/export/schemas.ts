import { z } from "zod";

const projectSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  color: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable().optional()
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
  branch: z.string().nullable(),
  status: z.string().trim().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  dueAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
  jiraTicket: z.string().nullable().optional()
});

const boardColumnSchema = z.object({
  id: z.number().int().positive().optional(),
  status: z.string().trim().min(1),
  label: z.string().trim().min(1),
  position: z.number().int().nonnegative(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

const ticketProjectLinkSchema = z.object({
  id: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  relationship: z.enum(["PRIMARY", "RELATED", "DEPENDENCY"]),
  createdAt: z.string()
});

const ticketJiraIssueLinkSchema = z.object({
  id: z.number().int().positive(),
  ticketId: z.number().int().positive(),
  issueKey: z.string(),
  issueSummary: z.string(),
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
      boardColumns: z.array(boardColumnSchema).default([]),
      tickets: z.array(ticketSchema),
      ticketProjectLinks: z.array(ticketProjectLinkSchema),
      ticketJiraIssueLinks: z.array(ticketJiraIssueLinkSchema).default([]),
      workContexts: z.array(workContextSchema),
      ticketActivities: z.array(ticketActivitySchema)
    })
  })
});
