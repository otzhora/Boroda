import { z } from "zod";

export const updateJiraSettingsSchema = z.object({
  baseUrl: z.string().trim().url().min(1),
  email: z.string().trim().email(),
  apiToken: z.string().trim().optional()
});
