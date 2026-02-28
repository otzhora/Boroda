import { z } from "zod";

const workContextTypeSchema = z.enum([
  "CODEX_SESSION",
  "CLAUDE_SESSION",
  "CURSOR_SESSION",
  "PR",
  "AWS_CONSOLE",
  "TERRAFORM_RUN",
  "MANUAL_UI",
  "LINK",
  "NOTE"
]);

export const workContextIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const ticketIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createWorkContextSchema = z.object({
  type: workContextTypeSchema,
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  meta: z.record(z.unknown()).default({})
});

export const updateWorkContextSchema = createWorkContextSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided"
);
