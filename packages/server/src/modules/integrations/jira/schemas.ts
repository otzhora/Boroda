import { z } from "zod";

export const updateJiraSettingsSchema = z.object({
  baseUrl: z.string().trim().url().min(1),
  email: z.string().trim().email(),
  apiToken: z.string().trim().optional()
});

export const jiraIssueKeyParamSchema = z.object({
  key: z.string().trim().min(1)
});

export const jiraLinkableTicketsQuerySchema = z.object({
  q: z.string().optional()
});
