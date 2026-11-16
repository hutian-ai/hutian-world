import { z } from "zod";

export const executionActivitySchema = z.object({
  version: z.literal(1),
  runId: z.string(),
  revision: z.number(),
  state: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  steering: z.boolean(),
  historyTruncated: z.boolean(),
  events: z.array(
    z.object({
      sequence: z.number(),
      at: z.string(),
      type: z.string(),
      payload: z.record(z.string(), z.unknown()),
    }),
  ),
  interactions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      canAllow: z.boolean(),
      details: z.unknown().optional(),
      options: z
        .array(
          z.object({
            optionId: z.string(),
            name: z.string(),
            kind: z.string(),
          }),
        )
        .optional(),
      form: z
        .object({
          mode: z.string(),
          message: z.string(),
          requestedSchema: z.record(z.string(), z.unknown()).optional(),
          url: z.string().optional(),
        })
        .optional(),
    }),
  ),
  commands: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      status: z.string(),
      result: z.unknown().optional(),
      at: z.string(),
    }),
  ),
  outputs: z.array(
    z.object({ reference: z.string(), name: z.string(), sha256: z.string() }),
  ),
  outputsState: z
    .enum(["pending", "available", "none", "unconfirmed"])
    .default("none"),
});
export type ExecutionActivity = z.infer<typeof executionActivitySchema>;
export const chatRequestInput = z
  .object({
    id: z.uuid(),
    roomId: z.string().startsWith("!").max(500),
    eventId: z.string().startsWith("$").max(500),
    agentId: z.string().regex(/^[a-z][a-z0-9-]{0,49}$/),
    context: z.record(z.string(), z.unknown()),
  })
  .strict();
export type ChatRequestInput = z.infer<typeof chatRequestInput>;
export interface ChatRequestRecord {
  id: string;
  workspaceId: string;
  requestedByUserId: string;
  communicationConnectionId: string;
  runtimeConnectionId: string;
  snapshot: ChatRequestInput;
  state: string;
  runId: string | null;
  replyEventId: string | null;
  error: string | null;
}
