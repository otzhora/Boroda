import { z } from "zod";

export const projectIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const projectFolderIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const projectQuerySchema = z.object({
  scope: z.enum(["active", "archived", "all"]).default("active")
});

export const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  color: z.string().default("")
});

export const updateProjectSchema = createProjectSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided"
);

export const createProjectFolderSchema = z.object({
  label: z.string().min(1),
  path: z.string().min(1),
  defaultBranch: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .nullable()
    .optional(),
  kind: z.enum(["APP", "BACKEND", "TERRAFORM", "INFRA", "DOCS", "OTHER"]),
  isPrimary: z.boolean().default(false)
});

export const updateProjectFolderSchema = createProjectFolderSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided"
);
