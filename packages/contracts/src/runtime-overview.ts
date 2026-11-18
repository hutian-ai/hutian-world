import { z } from "zod";
import { executionPreferences } from "./execution-preferences.js";
export const runtimeOverviewInput = z
  .object({
    nodeId: z.uuid().optional(),
    provider: z.string().min(1).max(80).optional(),
    cursor: z.string().max(1000).optional(),
  })
  .strict()
  .refine((v) => !v.provider || !!v.nodeId, "请指定所在电脑");
export type RuntimeOverviewInput = z.infer<typeof runtimeOverviewInput>;
const work = z.object({
  id: z.uuid(),
  source: z.enum(["chat", "schedule"]),
  title: z.string(),
  nodeId: z.string(),
  provider: z.string(),
  roleId: z.string().nullable(),
  member: z.string(),
  state: z.string(),
  href: z.string(),
  model: z.string().nullable(),
  preferences: executionPreferences,
  createdAt: z.string(),
  updatedAt: z.string(),
  runId: z.string().nullable(),
});
export const runtimeOverviewSchema = z.object({
  checkedAt: z.string(),
  summaries: z.array(
    z.object({
      nodeId: z.string(),
      provider: z.string(),
      running: z.number(),
      queued: z.number(),
      attention: z.number(),
      total: z.number(),
      lastActivityAt: z.string().nullable(),
    }),
  ),
  members: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      nodeId: z.string(),
      provider: z.string(),
      preferences: executionPreferences,
    }),
  ),
  active: z.array(work),
  activeHasMore: z.boolean(),
  recent: z.array(work),
  nextCursor: z.string().nullable(),
});
export type RuntimeOverview = z.infer<typeof runtimeOverviewSchema>;
