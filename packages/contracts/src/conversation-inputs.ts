import { z } from "zod";
const roomId = z.string().startsWith("!").max(500);
const eventId = z.string().startsWith("$").max(500);
const agentId = z.string().regex(/^[a-z][a-z0-9-]{0,49}$/);
export const createCommunicationInput = z
  .object({
    kind: z.enum(["direct", "group", "channel"]),
    name: z.string().trim().min(1).max(80),
    agentIds: z.array(agentId).max(20).default([]),
    roleIds: z.array(z.uuid()).max(20).default([]),
    transactionId: z.uuid(),
  })
  .strict();
export type CreateCommunicationInput = z.input<typeof createCommunicationInput>;
export const postConversationInput = z
  .object({
    roomId,
    text: z.string().trim().min(1).max(16000),
    transactionId: z.uuid(),
    replyTo: eventId.optional(),
    uploadIds: z.array(z.uuid()).max(5).optional(),
    mentionedAgentIds: z.array(agentId).max(20).optional(),
  })
  .strict();
export type PostConversationInput = z.input<typeof postConversationInput>;
export const askConversationInput = z
  .object({
    roomId,
    eventId,
    agentId,
    resume: z.boolean().optional(),
    useMemory: z.boolean().optional(),
    useKnowledge: z.boolean().optional(),
    silentNoUpdate: z.boolean().optional(),
    executionMode: z.enum(["text", "task"]).optional(),
    scheduledRunId: z.uuid().optional(),
    timeoutMs: z.number().int().min(180000).max(3600000).optional(),
    runtimeMode: z.enum(["member", "manual", "conversation"]).optional(),
    expectedPreferenceVersion: z.string().nullable().optional(),
    expectedBindingVersion: z.string().nullable().optional(),
    runtime: z
      .object({ nodeId: z.uuid(), provider: z.string().min(1).max(128) })
      .optional(),
  })
  .strict();
export type AskConversationInput = z.input<typeof askConversationInput>;
export const controlConversationInput = z
  .object({
    roomId,
    eventId,
    agentId,
    runId: z.uuid(),
    operationId: z.uuid(),
    kind: z.enum(["steer", "stop", "respond"]),
    text: z.string().trim().min(1).max(16000).optional(),
    requestId: z.string().min(1).max(500).optional(),
    response: z.unknown().optional(),
  })
  .strict();
export type ControlConversationInput = z.input<typeof controlConversationInput>;
export const controlConversationQueueInput = z
  .object({ roomId, id: z.uuid(), action: z.enum(["cancel", "start"]) })
  .strict();
export type ControlConversationQueueInput = z.input<
  typeof controlConversationQueueInput
>;
export const retrieveConversationOutputsInput = z
  .object({ roomId, eventId, agentId, runId: z.uuid() })
  .strict();
export type RetrieveConversationOutputsInput = z.input<
  typeof retrieveConversationOutputsInput
>;
export const handoffConversationInput = z
  .object({
    roomId,
    sourceEventId: eventId,
    agentId,
    text: z.string().trim().min(1).max(12000),
    transactionId: z.uuid(),
    runtime: z
      .object({
        nodeId: z.uuid(),
        provider: z.string().min(1).max(128),
      })
      .optional(),
  })
  .strict();
export type HandoffConversationInput = z.input<typeof handoffConversationInput>;
