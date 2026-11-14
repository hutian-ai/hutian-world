"use server";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { getWorkspace } from "./api";
import {
  communicationRequest,
  readConversation,
  readDirectory,
} from "./communications";
import { prepareReferences } from "./resources";
import { conversationResourceScopes } from "./resource-scopes";
import { getDockConnection, getDockDevice } from "./dock";
import { ensureRoleAgent, roleExecutionContext } from "./role-chat";

const roomId = z.string().startsWith("!").max(500);
const eventId = z.string().startsWith("$").max(500);
const agentId = z.string().regex(/^[a-z][a-z0-9-]{0,49}$/);
function failure(error: unknown) {
  return {
    ok: false as const,
    error:
      error instanceof z.ZodError
        ? "提交信息有误，请检查所选会话、助手与内容。"
        : error instanceof Error && error.message.includes("ENOENT")
          ? "所需资源或执行连接尚未配置，请先检查连接。"
          : error instanceof Error
            ? error.message
            : "操作暂时未确认，请刷新核对。",
  };
}

export async function refreshConversation(id: string) {
  try {
    return {
      ok: true as const,
      conversation: await readConversation(roomId.parse(id)),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function createCommunication(input: unknown) {
  try {
    const value = z
      .object({
        kind: z.enum(["direct", "group", "channel"]),
        name: z.string().trim().min(1).max(80),
        agentIds: z.array(agentId).max(20).default([]),
        roleIds: z.array(z.uuid()).max(20).default([]),
        transactionId: z.uuid(),
      })
      .strict()
      .parse(input);
    if (value.agentIds.length + value.roleIds.length > 20) throw new Error("单次最多邀请 20 位成员。");
    if (value.kind === "direct" && value.agentIds.length + value.roleIds.length !== 1)
      throw new Error("请选择一位私聊对象。");
    const workspace = await getWorkspace();
    for (const id of new Set(value.roleIds)) {
      const role = workspace.roles.find(r => r.id === id);
      if (!role) throw new Error("所选成员不存在或不可访问。");
      const agent = await ensureRoleAgent(role);
      value.agentIds.push(agent.id);
    }
    value.agentIds = [...new Set(value.agentIds)];
    const directory = await readDirectory();
    if (value.agentIds.some((id) => !directory.agents.some((a) => a.id === id)))
      throw new Error("所选助手已不可用。");
    if (value.kind === "direct") {
      const { creator } = await getWorkspace();
      const peer = directory.agents.find((a) => a.id === value.agentIds[0])!;
      const hash = createHash("sha256")
        .update(`hutian-world:direct:${creator.id}:${peer.userId}`)
        .digest("hex");
      value.transactionId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    }
    const { roleIds: _roleIds, ...request } = value;
    const result = z
      .object({ room: z.object({ id: roomId }) })
      .parse(await communicationRequest("/api/rooms", request));
    return { ok: true as const, roomId: result.room.id };
  } catch (e) {
    return failure(e);
  }
}
export async function openRoleConversation(id: string) {
  try {
    const role = (await getWorkspace()).roles.find(r => r.id === z.uuid().parse(id));
    if (!role) throw new Error("成员不存在或不可访问。");
    return await createCommunication({ kind: "direct", name: role.name, roleIds: [role.id], transactionId: randomUUID() });
  } catch (e) { return failure(e); }
}
export async function postConversation(input: unknown) {
  try {
    const value = z
      .object({
        roomId,
        text: z.string().trim().min(1).max(16000),
        transactionId: z.uuid(),
        replyTo: eventId.optional(),
      })
      .strict()
      .parse(input);
    await readConversation(value.roomId);
    const result = z
      .object({ eventId })
      .parse(await communicationRequest("/api/messages", value));
    return { ok: true as const, eventId: result.eventId };
  } catch (e) {
    return failure(e);
  }
}
export async function askConversation(input: unknown) {
  try {
    const value = z
      .object({
        roomId,
        eventId,
        agentId,
        resume: z.boolean().optional(),
        useMemory: z.boolean().optional(),
        useKnowledge: z.boolean().optional(),
        silentNoUpdate: z.boolean().optional(),
        executionMode: z.enum(["text", "task"]).optional(),
        timeoutMs: z.number().int().min(180000).max(3600000).optional(),
        runtimeMode: z.enum(["member", "manual"]).optional(),
        runtime: z
          .object({ nodeId: z.uuid(), provider: z.string().min(1).max(128) })
          .optional(),
      })
      .strict()
      .parse(input);
    const state = await readConversation(value.roomId);
    if (!state.agents.some((a) => a.id === value.agentId && a.joined))
      throw new Error("请先邀请这位助手加入当前会话。");
    const message = state.messages.find(
      (m) => m.id === value.eventId && m.sender === "human",
    );
    if (!message) throw new Error("只能处理当前会话中你发出的消息。");
    // Reopening an existing run only observes its original context and Runtime.
    if (value.resume || state.jobs.some(job => job.eventId === value.eventId && job.agentId === value.agentId)) {
      await communicationRequest("/api/agent/resume", {
        roomId: value.roomId,
        eventId: value.eventId,
        agentId: value.agentId,
      });
      return { ok: true as const, references: [] };
    }
    const workspace = await getWorkspace();
    const role = workspace.roles.find(r => r.chatIdentity?.agentId === value.agentId);
    const peer = state.agents.find(a => a.id === value.agentId)!;
    if (role && role.chatIdentity?.userId !== peer.userId)
      throw new Error("角色通信身份与当前房间不一致，未派发执行。");
    if (value.runtimeMode === "member" && value.runtime) throw new Error("请选择使用成员默认或临时 Runtime。");
    const selectedRuntime = value.runtimeMode === "member" ? role?.runtimeBinding : value.runtime;
    if (!selectedRuntime) throw new Error(value.runtimeMode === "member" ? "这位成员尚未设置默认 Runtime，请在执行配置中设置或在聊天中临时选择。" : "请明确选择这次回复使用的 Runtime。");
    let runtimeLabel = "";
    {
      const device = await getDockDevice(selectedRuntime.nodeId);
      if (
        device.state !== "online" ||
        !device.runtimes.some(
          (r) => r.key === selectedRuntime.provider && r.status === "ready",
        )
      )
        throw new Error("所选 Runtime 当前不可用，消息已保留，未派发执行。");
      runtimeLabel = `${value.runtimeMode === "member" ? "成员默认 · " : ""}${device.device.label || device.device.nodeId} · ${device.runtimes.find(r => r.key === selectedRuntime.provider)!.displayName}`.slice(0, 200);
    }
    if (role) await ensureRoleAgent(role);
    const { references, material } = await prepareReferences(
      message.text,
      Boolean(value.useMemory),
      Boolean(value.useKnowledge),
      await conversationResourceScopes(value.roomId, role?.id),
    );
    await communicationRequest("/api/agent", {
      roomId: value.roomId,
      eventId: value.eventId,
      agentId: value.agentId,
      context: {
        ...(role ? roleExecutionContext(role) : {}),
        ...(runtimeLabel ? { runtimeLabel } : {}),
        ...(material ? { material } : {}),
        nodeId: selectedRuntime.nodeId,
        provider: selectedRuntime.provider,
        connectionId: "workspace",
        ...(value.silentNoUpdate === undefined ? {} : { silentNoUpdate: value.silentNoUpdate }),
        ...(value.executionMode ? { executionMode: value.executionMode } : {}),
        ...(value.timeoutMs ? { timeoutMs: value.timeoutMs } : {}),
      },
    });
    return { ok: true as const, references };
  } catch (e) {
    return failure(e);
  }
}
export async function discoverChatRuntimes() {
  try {
    const connection = await getDockConnection();
    if (connection.state !== "connected")
      throw new Error("尚未连接运行环境，请先在运行环境中配置。");
    return {
      ok: true as const,
      runtimes: connection.devices.flatMap((d) =>
        d.runtimes
          .filter((r) => r.status === "ready")
          .map((r) => ({
            nodeId: d.nodeId,
            provider: r.key,
            label: `${d.label ?? "电脑"} · ${r.displayName}`,
          })),
      ),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function inviteConversation(id: string, peer: string) {
  try {
    await readConversation(roomId.parse(id));
    if ((await readDirectory()).rooms.find(room => room.id === id)?.kind === "direct")
      throw new Error("私聊保留两位参与者；多人讨论请新建群聊，私有资料不会随之共享。");
    let target = peer;
    if (peer.startsWith("role:")) {
      const role = (await getWorkspace()).roles.find(r => r.id === z.uuid().parse(peer.slice(5)));
      if (!role) throw new Error("成员不存在或不可访问。");
      target = (await ensureRoleAgent(role)).id;
    }
    await communicationRequest("/api/members", {
      roomId: id,
      agentId: agentId.parse(target),
    });
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
