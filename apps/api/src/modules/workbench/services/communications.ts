import { z } from "zod";
import type { Role, ChatRequestRecord } from "@hutian-world/contracts";
import { getWorkspace, api } from "./api.js";
import { requireLocalConnection } from "./access-bindings.js";
import {
  executionActivitySchema,
  executionPreferences,
  runtimeDisplayLabel,
  type RuntimeDeviceNames,
} from "@hutian-world/contracts";

const agent = z.object({
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
const room = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["direct", "group", "channel"]).default("group"),
});
export const directorySchema = z.object({
  rooms: z.array(room),
  agents: z.array(agent),
});
export const conversationSchema = z.object({
  room: z.object({ id: z.string(), name: z.string() }),
  members: z.array(
    z.object({ id: z.string(), name: z.string(), kind: z.string() }),
  ),
  agents: z.array(agent),
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
  Role,
  "id" | "name" | "description" | "chatIdentity" | "runtimeBinding"
>;
export type ChatDirectory = z.infer<typeof directorySchema> & {
  roles: ChatRole[];
};
export type Conversation = z.infer<typeof conversationSchema>;
export type RoomKind = z.infer<typeof room>["kind"];

const agentRunSchema = z.object({
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

/** Observe only this original request, independent of the room's history. */
export async function readAgentRun(
  roomId: string,
  eventId: string,
  agentId: string,
) {
  return agentRunSchema.parse(
    await communicationRequest(
      `/api/agent/status?${new URLSearchParams({ roomId, eventId, agentId })}`,
    ),
  );
}

export async function readRoom(id: string) {
  z.string().startsWith("!").max(500).parse(id);
  const [response, workspace] = await Promise.all([
    communicationRequest(`/api/room?${new URLSearchParams({ roomId: id })}`),
    getWorkspace(),
  ]);
  const state = z
    .object({
      room,
      members: conversationSchema.shape.members,
      agents: conversationSchema.shape.agents,
    })
    .parse(response);
  return {
    ...state,
    agents: state.agents.map((a) => roleAgent(a, workspace.roles)),
  };
}

export async function communicationRequest(path: string, body?: unknown) {
  await requireLocalConnection("matrix");
  const origin = new URL(
    process.env.HUTIAN_CHAT_URL ?? "http://127.0.0.1:3310",
  );
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1")
    throw new Error("通信地址必须是可信的本机宿主。");
  let response: Response;
  try {
    response = await fetch(origin.origin + path, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: origin.origin,
            },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new Error("通信服务暂时不可用，已保留会话，请稍后重新连接。");
  }
  if (!response.ok && path.startsWith("/api/runtime?")) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.error === "string"
        ? body.error.slice(0, 400)
        : "执行连接暂不可读取，请稍后刷新。",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "已有运行正在处理，先查看当前状态。"
        : "通信操作未确认，请刷新核对原消息与运行。",
    );
  return response.json() as Promise<unknown>;
}
export async function readDirectory() {
  const [response, workspace, workRooms] = await Promise.all([
    communicationRequest("/api/rooms"),
    getWorkspace(),
    api<string[]>("/v1/schedules/rooms"),
  ]);
  const directory = directorySchema.parse(response);
  return {
    ...directory,
    rooms: directory.rooms.filter((room) => !workRooms.includes(room.id)),
    agents: directory.agents.map((a) => roleAgent(a, workspace.roles)),
    roles: workspace.roles.map(
      ({ id, name, description, chatIdentity, runtimeBinding }) => ({
        id,
        name,
        description,
        chatIdentity,
        runtimeBinding,
      }),
    ),
  };
}
function roleAgent(a: z.infer<typeof agent>, roles: Role[]) {
  const role = roles.find(
    (r) =>
      r.chatIdentity?.agentId === a.id && r.chatIdentity.userId === a.userId,
  );
  return role
    ? {
        ...a,
        name: role.name,
        description: role.description,
        roleId: role.id,
        runtimeBinding: role.runtimeBinding
          ? {
              ...role.runtimeBinding,
              preferences: role.runtimeBinding.preferences ?? {},
            }
          : null,
      }
    : a;
}
export async function readConversation(id: string, cursor?: string) {
  z.string().startsWith("!").max(500).parse(id);
  // The communication host checks the operator's current Matrix membership on
  // every state read. Avoid re-reading every room on each polling request.
  const [response, workspace] = await Promise.all([
    communicationRequest(
      `/api/state?${new URLSearchParams({ roomId: id, ...(cursor ? { cursor: z.string().max(4000).parse(cursor) } : {}) })}`,
    ),
    getWorkspace(),
  ]);
  const conversation = conversationSchema.parse(response);
  const requests = await api<ChatRequestRecord[]>(
    `/v1/chat-requests?${new URLSearchParams({ roomId: id })}`,
  ).catch(() => []);
  for (const request of requests) {
    if (
      !conversation.messages.some((m) => m.id === request.snapshot.eventId) ||
      conversation.jobs.some(
        (j) =>
          j.eventId === request.snapshot.eventId &&
          j.agentId === request.snapshot.agentId,
      )
    )
      continue;
    conversation.jobs.push({
      references: [],
      agentId: request.snapshot.agentId,
      eventId: request.snapshot.eventId,
      runId: request.runId,
      state: request.state,
      error: request.error,
      nodeId:
        typeof request.snapshot.context.nodeId === "string"
          ? request.snapshot.context.nodeId
          : null,
      provider:
        typeof request.snapshot.context.provider === "string"
          ? request.snapshot.context.provider
          : null,
      model:
        typeof request.snapshot.context.model === "string"
          ? request.snapshot.context.model
          : null,
      config: conversationSchema.shape.jobs.element.shape.config.parse(
        request.snapshot.context.config,
      ),
    });
  }
  const names = await api<RuntimeDeviceNames>("/v1/runtime-devices");
  for (const job of conversation.jobs) {
    if (job.nodeId)
      job.runtimeLabel = runtimeDisplayLabel(
        job.nodeId,
        job.provider,
        names.settings.find((n) => n.nodeId === job.nodeId)?.customName,
      );
    const request = requests.find(
      (r) =>
        r.snapshot.eventId === job.eventId &&
        r.snapshot.agentId === job.agentId,
    );
    job.references =
      conversationSchema.shape.jobs.element.shape.references.parse(
        request?.snapshot.context.references ?? [],
      );
  }
  const agents = conversation.agents.map((a) => roleAgent(a, workspace.roles));
  return {
    ...conversation,
    agents,
    members: conversation.members.map((member) => {
      const profile = agents.find((a) => a.userId === member.id);
      return profile ? { ...member, name: profile.name } : member;
    }),
    messages: conversation.messages.map((message) => {
      const profile = agents.find((a) => a.id === message.agentId);
      return profile ? { ...message, name: profile.name } : message;
    }),
  };
}
