import { z } from "zod";

export const validatePathSchema = z.object({
  path: z.string().min(1)
});

