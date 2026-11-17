import { z } from "zod";
export const executionPreferences = z
  .object({
    model: z.string().trim().min(1).max(200).optional(),
    effort: z.string().trim().min(1).max(80).optional(),
    mode: z.string().trim().min(1).max(80).optional(),
    serviceTier: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
export type ExecutionPreferences = z.infer<typeof executionPreferences>;
