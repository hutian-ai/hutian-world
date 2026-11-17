import {
  HostClientError,
  LocalHostClient,
} from "@hutian-ai/matrix-agents-chat/host-client";
import type { Role } from "@hutian-world/contracts";
import {
  agentSchema as agent,
  agentRunSchema,
  conversationSchema,
  directorySchema,
  roomSchema as room,
  runtimeDisplayLabel,
} from "@hutian-world/contracts";
import { z } from "zod";
import { ApplicationError } from "../../common/errors/application-error.js";
import { requireLocalConnection } from "../../modules/access/connection-access.js";
import type { ApplicationServices } from "../application-services.js";
export { conversationSchema, directorySchema } from "@hutian-world/contracts";
export type {
  AgentRunObservation,
  ChatDirectory,
  ChatRole,
  Conversation,
  RoomKind,
} from "@hutian-world/contracts";
function parseHostResponse<T>(schema: z.ZodType<T>, response: unknown): T {
  const result = schema.safeParse(response);
  if (!result.success) {
    throw new ApplicationError(
      "通信服务响应不符合协议，请核对原消息与运行。",
      50200,
      502,
      "observe",
      { cause: result.error },
    );
  }
  return result.data;
}
/** Observe only this original request, independent of the room's history. */
export async function readAgentRun(
  app: Pick<ApplicationServices, "contexts">,
  roomId: string,
  eventId: string,
  agentId: string,
) {
  return parseHostResponse(
    agentRunSchema,
    await communicationRequest(
      app,
      `/api/agent/status?${new URLSearchParams({ roomId, eventId, agentId })}`,
    ),
  );
}
export async function readRoom(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  id: string,
) {
  z.string().startsWith("!").max(500).parse(id);
  const [response, workspace] = await Promise.all([
    communicationRequest(
      app,
      `/api/room?${new URLSearchParams({ roomId: id })}`,
    ),
    app.workspace.overview(),
  ]);
  const state = parseHostResponse(
    z.object({
      room,
      members: conversationSchema.shape.members,
      agents: conversationSchema.shape.agents,
    }),
    response,
  );
  return {
    ...state,
    agents: state.agents.map((a) => roleAgent(a, workspace.roles)),
  };
}
export async function communicationRequest(
  app: Pick<ApplicationServices, "contexts">,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
) {
  await requireLocalConnection(app, "matrix");
  try {
    return await new LocalHostClient(
      process.env.HUTIAN_CHAT_URL ?? "http://127.0.0.1:3310",
    ).request(path, body, signal);
  } catch (error) {
    if (!(error instanceof HostClientError)) throw error;
    const status = [400, 403, 404, 409, 422, 429, 503].includes(error.status)
      ? error.status
      : 502;
    const messages: Record<number, string> = {
      400: "通信请求内容无效。",
      403: "当前身份无权访问此通信资源。",
      404: "通信资源不存在或不可访问。",
      409: "已有运行正在处理，先查看当前状态。",
      422: "通信操作不满足当前状态要求。",
      429: "通信服务繁忙，请稍后重试。",
      502: "通信协议或响应未确认，请核对原消息与运行。",
      503: "通信服务暂时不可用，请稍后核对原运行。",
    };
    throw new ApplicationError(
      messages[status]!,
      (status * 100) as import("@hutian-world/contracts").ErrorCode,
      status,
      status === 409 ? "refresh" : status >= 500 ? "observe" : "none",
      { cause: error },
    );
  }
}

export async function readDirectory(
  app: Pick<ApplicationServices, "contexts" | "schedules" | "workspace">,
) {
  const [response, workspace, workRooms] = await Promise.all([
    communicationRequest(app, "/api/rooms"),
    app.workspace.overview(),
    app.schedules.workRooms(),
  ]);
  const directory = parseHostResponse(directorySchema, response);
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
export async function readConversation(
  app: Pick<
    ApplicationServices,
    "contexts" | "devices" | "requests" | "workspace"
  >,
  id: string,
  cursor?: string,
  signal?: AbortSignal,
) {
  z.string().startsWith("!").max(500).parse(id);
  // The communication host checks the operator's current Matrix membership on
  // every state read. Avoid re-reading every room on each polling request.
  const [response, workspace] = await Promise.all([
    communicationRequest(
      app,
      `/api/state?${new URLSearchParams({ roomId: id, ...(cursor ? { cursor: z.string().max(4000).parse(cursor) } : {}) })}`,
      undefined,
      signal,
    ),
    app.workspace.overview(),
  ]);
  const conversation = parseHostResponse(conversationSchema, response);
  const requests = await app.requests.list(id);
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
  const names = await app.devices.list();
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
