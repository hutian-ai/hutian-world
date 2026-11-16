import { z } from "zod";
import type { ScheduledRunSnapshot } from "@hutian-world/contracts";
import { createHash, randomUUID } from "node:crypto";
import { getWorkspace, api } from "./api.js";
import {
  communicationRequest,
  readConversation,
  readDirectory,
  readRoom,
  readAgentRun,
} from "./communications.js";
import { createContextTools } from "./chat-context-tools.js";
import { prepareReferences } from "./resources.js";
import { conversationResourceScopes } from "./resource-scopes.js";
import { getDockConnection, getDockDevice } from "./dock.js";
import { ensureRoleAgent, roleExecutionContext } from "./role-chat.js";
import { validateExecution } from "./execution-settings.js";

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
    if (value.agentIds.length + value.roleIds.length > 20)
      throw new Error("单次最多邀请 20 位成员。");
    if (
      value.kind === "direct" &&
      value.agentIds.length + value.roleIds.length !== 1
    )
      throw new Error("请选择一位私聊对象。");
    const workspace = await getWorkspace();
    for (const id of new Set(value.roleIds)) {
      const role = workspace.roles.find((r) => r.id === id);
      if (!role) throw new Error("所选成员不存在或不可访问。");
      const agent = await ensureRoleAgent(role);
      value.agentIds.push(agent.id);
    }
    value.agentIds = [...new Set(value.agentIds)];
    const directory = await readDirectory();
    if (value.agentIds.some((id) => !directory.agents.some((a) => a.id === id)))
      throw new Error("所选助手已不可用。");
    if (value.kind === "direct") {
      const peer = directory.agents.find((a) => a.id === value.agentIds[0])!;
      const hash = createHash("sha256")
        .update(
          `hutian-world:direct:${workspace.access.resourceNamespace}:${peer.userId}`,
        )
        .digest("hex");
      value.transactionId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    }
    const request = {
      kind: value.kind,
      name: value.name,
      agentIds: value.agentIds,
      transactionId: value.transactionId,
    };
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
    const role = (await getWorkspace()).roles.find(
      (r) => r.id === z.uuid().parse(id),
    );
    if (!role) throw new Error("成员不存在或不可访问。");
    return await createCommunication({
      kind: "direct",
      name: role.name,
      roleIds: [role.id],
      transactionId: randomUUID(),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function postConversation(input: unknown) {
  try {
    const value = z
      .object({
        roomId,
        text: z.string().trim().min(1).max(16000),
        transactionId: z.uuid(),
        replyTo: eventId.optional(),
        uploadIds: z.array(z.uuid()).max(5).optional(),
        mentionedAgentIds: z.array(agentId).max(20).optional(),
      })
      .strict()
      .parse(input);
    const state = await readRoom(value.roomId);
    if (
      value.mentionedAgentIds?.some(
        (id) => !state.agents.some((a) => a.id === id && a.joined),
      )
    )
      throw new Error("点名成员已不可用，请重新选择后发送。");
    const result = z
      .object({ eventId })
      .parse(await communicationRequest("/api/messages", value));
    return { ok: true as const, eventId: result.eventId };
  } catch (e) {
    return failure(e);
  }
}
export async function askConversation(
  input: unknown,
  frozenRuntime?: NonNullable<ScheduledRunSnapshot["runtime"]>,
) {
  let submitted = false;
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
        runtimeMode: z.enum(["member", "manual", "conversation"]).optional(),
        expectedPreferenceVersion: z.string().nullable().optional(),
        expectedBindingVersion: z.string().nullable().optional(),
        runtime: z
          .object({ nodeId: z.uuid(), provider: z.string().min(1).max(128) })
          .optional(),
      })
      .strict()
      .parse(input);
    const state =
      value.executionMode === undefined
        ? await readConversation(value.roomId)
        : await readRoom(value.roomId);
    if (!state.agents.some((a) => a.id === value.agentId && a.joined))
      throw new Error("请先邀请这位助手加入当前会话。");
    let message: { text: string } | undefined =
      "messages" in state
        ? state.messages.find(
            (m) => m.id === value.eventId && m.sender === "human",
          )
        : undefined;
    if (!message) {
      const source = z
        .object({ id: eventId, text: z.string(), isOwn: z.literal(true) })
        .parse(
          await communicationRequest(
            `/api/message?${new URLSearchParams({ roomId: value.roomId, eventId: value.eventId })}`,
          ),
        );
      // The host's dispatch/resume endpoint independently checks the real Matrix sender.
      message = source;
    }
    if (!message) throw new Error("只能处理当前会话中你发出的消息。");
    // Reopening an existing run only observes its original context and Runtime.
    const existingJob =
      "jobs" in state
        ? state.jobs.find(
            (job) =>
              job.eventId === value.eventId && job.agentId === value.agentId,
          )
        : (await readAgentRun(value.roomId, value.eventId, value.agentId)).job;
    if (
      existingJob &&
      !existingJob.runId &&
      ["accepted", "preparing", "queued"].includes(existingJob.state)
    )
      return { ok: true as const, references: [] };
    if (value.resume || existingJob) {
      submitted = true;
      await communicationRequest("/api/agent/resume", {
        roomId: value.roomId,
        eventId: value.eventId,
        agentId: value.agentId,
      });
      return { ok: true as const, references: [] };
    }
    const workspace = await getWorkspace();
    const role = workspace.roles.find(
      (r) => r.chatIdentity?.agentId === value.agentId,
    );
    const peer = state.agents.find((a) => a.id === value.agentId)!;
    if (role && role.chatIdentity?.userId !== peer.userId)
      throw new Error("角色通信身份与当前房间不一致，未派发执行。");
    if (value.runtimeMode === "conversation")
      throw new Error(
        "会话执行覆盖已停用，请刷新页面后使用成员配置。原消息已保留。",
      );
    if (value.runtimeMode === "member" && value.runtime)
      throw new Error("成员模式不接受临时 Runtime，请在成员执行配置中修改。");
    if (
      value.runtimeMode === "member" &&
      value.expectedBindingVersion !== undefined &&
      value.expectedBindingVersion !== (role?.runtimeBinding?.updatedAt ?? null)
    )
      throw new Error("执行配置已变更，请核对最新选择后重新请求这条消息。");
    const selectedRuntime =
      frozenRuntime ??
      (value.runtimeMode === "member" ? role?.runtimeBinding : value.runtime);
    if (!selectedRuntime)
      throw new Error(
        value.runtimeMode === "member"
          ? "这位成员尚未设置运行环境，请在成员执行配置中设置。"
          : "请明确选择这次回复使用的 Runtime。",
      );
    let runtimeLabel = "";
    let execution: {
      model?: string;
      config?: { effort?: string; serviceTier?: string; mode?: string };
    } = {};
    {
      const device = await getDockDevice(selectedRuntime.nodeId);
      if (device.state !== "online")
        throw new Error(
          "message" in device
            ? device.message
            : "所选设备当前离线，消息已保留。",
        );
      const provider = device.runtimes.find(
        (r) => r.key === selectedRuntime.provider,
      );
      if (!provider || provider.status !== "ready")
        throw new Error(
          provider?.message ?? "所选 Harness 当前未就绪，消息已保留。",
        );
      runtimeLabel =
        `${value.runtimeMode === "member" ? "成员默认 · " : ""}${device.device.label || device.device.nodeId} · ${device.runtimes.find((r) => r.key === selectedRuntime.provider)!.displayName}`.slice(
          0,
          200,
        );
      const preferences =
        frozenRuntime?.preferences ??
        (value.runtimeMode === "member"
          ? (role?.runtimeBinding?.preferences ?? {})
          : {});
      if (value.executionMode === undefined || frozenRuntime) {
        const frozen = { ...preferences };
        frozen.model ??= provider.defaults.model;
        frozen.mode ??= provider.defaults.mode;
        const model = provider.models.find((m) => m.id === frozen.model);
        if (
          !frozen.effort &&
          provider.defaults.effort &&
          model?.efforts.includes(provider.defaults.effort)
        )
          frozen.effort = provider.defaults.effort;
        execution = validateExecution(frozen, {
          label: runtimeLabel,
          models: provider.models,
          current: provider.defaults,
          permissionModes: provider.permissionModes,
        });
      }
    }
    if (role) await ensureRoleAgent(role);
    const { references, material } = await prepareReferences(
      message.text,
      value.useMemory !== false,
      value.useKnowledge !== false,
      await conversationResourceScopes(value.roomId, role?.id),
    );
    const request = {
      roomId: value.roomId,
      eventId: value.eventId,
      agentId: value.agentId,
      context: {
        ...(role ? roleExecutionContext(role) : {}),
        ...(runtimeLabel ? { runtimeLabel } : {}),
        ...(material ? { material } : {}),
        references,
        ...(value.executionMode === undefined
          ? await createContextTools(
              {
                roomId: value.roomId,
                eventId: value.eventId,
                roleId: role?.id,
                agentId: value.agentId,
                useMemory: value.useMemory !== false,
                useKnowledge: value.useKnowledge !== false,
              },
              material,
            )
          : {}),
        nodeId: selectedRuntime.nodeId,
        provider: selectedRuntime.provider,
        ...execution,
        connectionId: "workspace",
        interactive: true,
        ...(value.executionMode === undefined
          ? { executionMode: "task", timeoutMs: 3600000 }
          : {}),
        ...(value.silentNoUpdate === undefined
          ? {}
          : { silentNoUpdate: value.silentNoUpdate }),
        ...(value.executionMode ? { executionMode: value.executionMode } : {}),
        ...(value.timeoutMs ? { timeoutMs: value.timeoutMs } : {}),
      },
    };
    submitted = true;
    if (value.executionMode === undefined) {
      const hash = createHash("sha256")
        .update(
          JSON.stringify([
            workspace.access.workspaceId,
            value.roomId,
            value.eventId,
            value.agentId,
          ]),
        )
        .digest("hex");
      const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      await api("/v1/chat-requests", "POST", { id, ...request });
    } else
      await communicationRequest("/api/agent", {
        ...request,
        context: Object.fromEntries(
          Object.entries(request.context).filter(
            ([key]) => key !== "references",
          ),
        ),
      });
    return { ok: true as const, references };
  } catch (e) {
    return {
      ...failure(e),
      submission: submitted
        ? ("unconfirmed" as const)
        : ("not_submitted" as const),
    };
  }
}
export async function discoverChatRuntimes() {
  try {
    const connection = await getDockConnection();
    if (connection.state !== "connected")
      throw new Error(
        connection.state === "missing"
          ? "尚未配置运行环境连接，请在运行环境中配置。"
          : connection.message,
      );
    return {
      ok: true as const,
      pendingDevices: connection.devices
        .filter((d) => d.connected && d.inventoryState === "unknown")
        .map((d) => ({ nodeId: d.nodeId, label: d.label ?? "电脑" })),
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
export async function controlConversation(input: unknown) {
  try {
    const value = z
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
      .strict()
      .parse(input);
    const conversation = await readConversation(value.roomId);
    if (!conversation.agents.some((a) => a.id === value.agentId && a.joined))
      throw new Error("原运行已不可操作，请刷新核对。");
    const result = await communicationRequest("/api/agent/control", value);
    return { ok: true as const, result };
  } catch (e) {
    return failure(e);
  }
}
export async function controlConversationQueue(input: unknown) {
  try {
    const value = z
      .object({ roomId, id: z.uuid(), action: z.enum(["cancel", "start"]) })
      .strict()
      .parse(input);
    await readConversation(value.roomId);
    await communicationRequest("/api/agent/queue", value);
    return { ok: true as const };
  } catch (e) {
    return failure(e);
  }
}
export async function retrieveConversationOutputs(input: unknown) {
  try {
    const value = z
      .object({ roomId, eventId, agentId, runId: z.uuid() })
      .strict()
      .parse(input);
    await readConversation(value.roomId);
    await communicationRequest("/api/agent/outputs/retrieve", value);
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function handoffConversation(input: unknown) {
  try {
    const value = z
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
      .strict()
      .parse(input);
    const state = await readConversation(value.roomId);
    z.object({ agentId: z.string() }).parse(
      await communicationRequest(
        `/api/message?${new URLSearchParams({ roomId: value.roomId, eventId: value.sourceEventId })}`,
      ),
    );
    const recipient = state.agents.find(
      (a) => a.id === value.agentId && a.joined,
    );
    if (!recipient) throw new Error("请先邀请接手成员进入当前会话。");
    if (!recipient.runtimeBinding)
      throw new Error("接手成员尚未配置运行环境，请先在成员执行配置中设置。");
    const posted = await postConversation({
      roomId: value.roomId,
      text: value.text,
      transactionId: value.transactionId,
      replyTo: value.sourceEventId,
    });
    if (!posted.ok) return posted;
    const asked = await askConversation({
      roomId: value.roomId,
      eventId: posted.eventId,
      agentId: value.agentId,
      runtimeMode: "member",
      expectedBindingVersion: recipient.runtimeBinding.updatedAt,
      useMemory: false,
      useKnowledge: false,
    });
    return asked.ok
      ? { ok: true as const, eventId: posted.eventId }
      : { ok: false as const, error: `交接消息已保存。${asked.error}` };
  } catch (e) {
    return failure(e);
  }
}
export async function inviteConversation(id: string, peer: string) {
  try {
    await readConversation(roomId.parse(id));
    if (
      (await readDirectory()).rooms.find((room) => room.id === id)?.kind ===
      "direct"
    )
      throw new Error(
        "私聊保留两位参与者；多人讨论请新建群聊，私有资料不会随之共享。",
      );
    let target = peer;
    if (peer.startsWith("role:")) {
      const role = (await getWorkspace()).roles.find(
        (r) => r.id === z.uuid().parse(peer.slice(5)),
      );
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
