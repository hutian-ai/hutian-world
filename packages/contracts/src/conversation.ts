import { z } from "zod";
import { executionActivitySchema } from "./chat.js";
import { executionPreferences } from "./execution-preferences.js";
import type * as Contracts from "./index.js";
export const agentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string(),
  joined: z.boolean().optional(),
  roleId: z.uuid().optional(),
  runtimeBinding: z
    .object({
      nodeId: z.uuid(),
      provider: z.string(),
      label: z.string(),
      preferences: executionPreferences.default({}),
      updatedAt: z.string(),
    })
    .nullable()
    .optional(),
});
export const roomSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["direct", "group", "channel"]).default("group"),
});
export const directorySchema = z.object({
  rooms: z.array(roomSchema),
  agents: z.array(agentSchema),
});
export const conversationSchema = z.object({
  room: z.object({ id: z.string(), name: z.string() }),
  members: z.array(
    z.object({ id: z.string(), name: z.string(), kind: z.string() }),
  ),
  agents: z.array(agentSchema),
  messages: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      timestamp: z.number(),
      sender: z.string(),
      name: z.string(),
      agentId: z.string().nullable(),
      replyTo: z.string().nullable(),
      attachments: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            mime: z.string(),
            size: z.number(),
          }),
        )
        .default([]),
      mentionedUserIds: z.array(z.string()).default([]),
    }),
  ),
  jobs: z.array(
    z.object({
      agentId: z.string(),
      eventId: z.string(),
      runId: z.string().nullable(),
      state: z.string(),
      error: z.string().nullable(),
      instructionsVersion: z.string().nullish(),
      instructionsLabel: z.string().nullish(),
      instructionsSource: z.string().nullish(),
      runtimeLabel: z.string().nullish(),
      nodeId: z.string().nullish(),
      provider: z.string().nullish(),
      model: z.string().nullish(),
      config: z
        .object({
          effort: z.string().optional(),
          mode: z.string().optional(),
          serviceTier: z.string().optional(),
        })
        .nullish(),
      activity: executionActivitySchema.nullish(),
      replyEventId: z.string().nullish(),
      references: z
        .array(z.object({ id: z.string(), title: z.string(), url: z.string() }))
        .default([]),
    }),
  ),
  queue: z
    .array(
      z.object({
        id: z.uuid(),
        eventId: z.string(),
        agentId: z.string(),
        state: z.enum(["queued", "paused"]),
        createdAt: z.number(),
      }),
    )
    .default([]),
  active: z
    .object({ agentId: z.string(), roomId: z.string(), eventId: z.string() })
    .nullable(),
  nextCursor: z.string().nullable().default(null),
});
export type ChatRole = Pick<
  Contracts.Role,
  "id" | "name" | "description" | "chatIdentity" | "runtimeBinding"
>;
export type ChatDirectory = z.infer<typeof directorySchema> & {
  roles: ChatRole[];
};
export type Conversation = z.infer<typeof conversationSchema>;
export type RoomKind = z.infer<typeof roomSchema>["kind"];
export const agentRunSchema = z.object({
  job: z
    .object({
      runId: z.uuid(),
      state: z.string(),
      replyEventId: z.string().nullable(),
      hasReceipt: z.boolean(),
      error: z.string().nullable(),
    })
    .nullable(),
  active: z.boolean(),
  busy: z.boolean(),
  checkedAt: z.number().nullable(),
  error: z.string().nullable(),
  queueState: z.string().nullable(),
  queued: z.boolean(),
  pendingPermissions: z
    .array(z.object({ id: z.uuid(), title: z.string() }))
    .default([]),
});
export type AgentRunObservation = z.infer<typeof agentRunSchema>;
