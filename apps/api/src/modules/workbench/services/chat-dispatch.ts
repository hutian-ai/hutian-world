import { reflectChat } from "./chat-context-tools.js";
import { z } from "zod";
import type { ChatRequestRecord } from "@hutian-world/contracts";
import { api, getWorkspace } from "./api.js";
import { getAccess, requireLocalConnection } from "./access-bindings.js";
import { communicationRequest, readConversation } from "./communications.js";

export async function dispatchChat(value: unknown) {
  try {
    const input = z
      .object({ id: z.uuid(), workspaceId: z.uuid(), userId: z.uuid() })
      .strict()
      .parse(value);
    const row = await api<ChatRequestRecord>(`/v1/chat-requests/${input.id}`);
    const access = await getAccess();
    const result = (
      state: string,
      error: string | null = null,
      runId: string | null = row.runId,
      replyEventId: string | null = row.replyEventId,
    ) => ({ state, error, runId, replyEventId });
    if (
      input.workspaceId !== access.workspaceId ||
      input.userId !== access.userId ||
      row.workspaceId !== access.workspaceId ||
      row.requestedByUserId !== access.userId ||
      row.communicationConnectionId !== access.connections.matrix ||
      row.runtimeConnectionId !== access.connections.dock
    )
      return result("blocked", "执行身份或连接范围不匹配");
    await requireLocalConnection("matrix");
    await requireLocalConnection("dock");
    const snapshot = row.snapshot;
    const state = await readConversation(snapshot.roomId);
    if (!state.agents.some((a) => a.id === snapshot.agentId && a.joined))
      return result("blocked", "原成员已不在当前会话");
    const source = String(snapshot.context.instructionsSource ?? "");
    if (source.startsWith("hutian://roles/")) {
      const role = (await getWorkspace()).roles.find(
        (r) => source === `hutian://roles/${r.id}`,
      );
      if (
        !role ||
        role.chatIdentity?.agentId !== snapshot.agentId ||
        !state.agents.some(
          (a) =>
            a.id === snapshot.agentId && a.userId === role.chatIdentity?.userId,
        )
      )
        return result("blocked", "原角色通信身份已变更");
    }
    const status = (await communicationRequest(
      `/api/agent/status?${new URLSearchParams({ roomId: snapshot.roomId, eventId: snapshot.eventId, agentId: snapshot.agentId })}`,
    )) as {
      job: {
        runId: string;
        state: string;
        replyEventId: string | null;
        hasReceipt: boolean;
      } | null;
      active: boolean;
      queued: boolean;
      queueState?: string | null;
    };
    if (status.queueState === "cancelled" && !status.job)
      return result("cancelled");
    if (status.job?.replyEventId) {
      if (typeof snapshot.context.toolBridgeToken === "string")
        await reflectChat(
          snapshot.context.toolBridgeToken,
          status.job.replyEventId,
        );
      return result("replied", null, status.job.runId, status.job.replyEventId);
    }
    if (
      status.job &&
      ["failed", "cancelled", "skipped"].includes(status.job.state)
    )
      return result(status.job.state, null, status.job.runId);
    if (status.active)
      return result("running", null, status.job?.runId ?? row.runId);
    if (status.queued) return result("queued");
    if (status.job) {
      if (row.runId && row.runId !== status.job.runId)
        return result("blocked", "原执行关联不一致");
      if (!status.job.hasReceipt)
        return result(
          "unknown",
          "原请求尚无回执，保留记录，未重新派发",
          status.job.runId,
        );
      await communicationRequest("/api/agent/resume", {
        roomId: snapshot.roomId,
        eventId: snapshot.eventId,
        agentId: snapshot.agentId,
      });
      return result("unknown", null, status.job.runId);
    }
    await communicationRequest("/api/agent", {
      roomId: snapshot.roomId,
      eventId: snapshot.eventId,
      agentId: snapshot.agentId,
      context: Object.fromEntries(
        Object.entries(snapshot.context).filter(
          ([key]) => key !== "references",
        ),
      ),
    });
    return result("preparing");
  } catch {
    throw new Error("原工作协调尚未确认，继续观察同一请求。");
  }
}
