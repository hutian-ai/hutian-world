import type { ScheduledRun } from "@hutian-world/contracts";
import { z } from "zod";
import { ApplicationError } from "../../common/errors/application-error.js";
import {
  getAccess,
  requireLocalConnection,
} from "../../modules/access/connection-access.js";
import type { ApplicationServices } from "../application-services.js";
import {
  askConversation,
  postConversation,
} from "../conversations/communication-actions.js";
import {
  communicationRequest,
  readAgentRun,
  readRoom,
  type AgentRunObservation,
} from "../conversations/communications.js";
import { ensureRoleAgent } from "../members/role-chat.js";
export const runtime = "nodejs";
export async function observeScheduledRun(
  app: Pick<
    ApplicationServices,
    "contexts" | "devices" | "requests" | "roles" | "schedules" | "workspace"
  >,
  value: unknown,
) {
  try {
    const { id, workspaceId, runAsUserId } = z
      .object({ id: z.uuid(), workspaceId: z.uuid(), runAsUserId: z.uuid() })
      .strict()
      .parse(value);
    let run = await app.schedules.getRun(id);
    let task = run.snapshot;
    const result = (
      state: ScheduledRun["state"],
      error: string | null = null,
      runId: string | null = run.runId,
      replyEventId: string | null = run.replyEventId,
    ) => ({ state, error, runId, replyEventId });
    const access = await getAccess(app);
    if (
      workspaceId !== run.authority.workspaceId ||
      runAsUserId !== run.authority.runAsUserId ||
      workspaceId !== access.workspaceId ||
      runAsUserId !== access.userId ||
      run.authority.requestedByUserId !== access.userId ||
      run.authority.communicationConnectionId !== access.connections.matrix ||
      run.authority.runtimeConnectionId !== access.connections.dock
    )
      return result(
        "blocked",
        "原运行身份或连接范围与当前入口不一致，未使用默认身份代发",
      );
    if (["replied", "failed", "missed", "skipped"].includes(run.state))
      return result(run.state);
    await requireLocalConnection(app, "matrix");
    await requireLocalConnection(app, "dock");
    const role = (await app.workspace.overview()).roles.find(
      (r) => r.id === task.roleId,
    );
    if (!role) return result("failed", "负责成员已不可用，本次未执行。");
    if (!task.runtime)
      return result(
        "failed",
        "这位成员尚未配置运行环境。请在成员设置中配置后重新运行。",
      );
    const agent =
      role.chatIdentity ??
      (await ensureRoleAgent(app, role).then((agent) => ({
        agentId: agent.id,
        userId: agent.userId,
      })));
    if (!agent)
      return result("blocked", "成员通信身份尚未确认，稍后沿原记录核对。");
    const agentId = agent.agentId;
    if (!task.roomId) {
      const created = z
        .object({ room: z.object({ id: z.string().startsWith("!") }) })
        .parse(
          await communicationRequest(app, "/api/rooms", {
            kind: "direct",
            name: `${task.title.slice(0, 55)} · ${new Date(run.scheduledAt).toLocaleString("zh-CN", { timeZone: task.rule.timeZone })}`.slice(
              0,
              80,
            ),
            agentIds: [agentId],
            transactionId: run.id,
          }),
        );
      run = await app.schedules.recordRoom(id, created.room.id);
      task = run.snapshot;
    }
    const roomId = task.roomId!;
    const observe = () => readAgentRun(app, roomId, run.eventId!, agentId);
    const project = async (observation: AgentRunObservation) => {
      const job = observation.job;
      if (run.runId && job && run.runId !== job.runId)
        throw new ApplicationError("原运行标识不一致，未替换原执行。");
      if (job?.replyEventId)
        return result("replied", null, job.runId, job.replyEventId);
      if (job?.state === "skipped") return result("skipped", null, job.runId);
      if (job && ["failed", "cancelled", "canceled"].includes(job.state))
        return result(
          "failed",
          job.error ||
            (job.state === "failed"
              ? "执行失败，未交付完整结果。请查看原会话中的执行记录。"
              : "执行已取消，未交付完整结果。请查看原会话中的授权或停止记录。"),
          job.runId,
        );
      if (observation.queueState === "cancelled")
        return result("failed", "本次排队已取消", job?.runId);
      if (job?.state === "completed")
        return result("preparing", "执行已完成，正在交付原结果", job.runId);
      if (observation.active && observation.pendingPermissions.length) {
        return result(
          "waiting_permission",
          "等待你授权，请打开本次工作查看原请求。",
          job?.runId,
        );
      }
      if (observation.active) return result("running", null, job?.runId);
      if (observation.queueState === "paused")
        return result(
          "blocked",
          "原排队已暂停，请在本次工作中核对",
          job?.runId,
        );
      if (observation.queued) return result("queued", null, job?.runId);
      if (job)
        return result(
          "unknown",
          job.error || "正在核对原运行回执；未重新执行",
          job.runId,
        );
      if (run.runId)
        return result(
          "unknown",
          "原宿主记录暂不可读取；保留原运行，未重新执行",
        );
      return result(
        "queued",
        observation.error ||
          (observation.busy ? "执行宿主正在处理其他工作" : null),
      );
    };
    if (run.eventId) {
      const observation = await observe();
      const update = await project(observation);
      if (
        ["replied", "skipped", "failed"].includes(update.state) ||
        observation.active ||
        observation.queued ||
        observation.queueState === "paused"
      )
        return update;
      if (observation.job || run.runId) {
        // Recovery and delivery reuse the original receipt, never the new-run path.
        if (
          observation.job?.hasReceipt &&
          !observation.busy &&
          (!observation.checkedAt ||
            Date.now() - observation.checkedAt >= 30000)
        ) {
          await communicationRequest(app, "/api/agent/resume", {
            roomId: roomId,
            eventId: run.eventId,
            agentId,
          });
          return project(await observe());
        }
        return update;
      }
      if (
        Date.now() - Date.parse(run.scheduledAt) >
        task.startWindowMinutes * 60000
      )
        return result("missed", "等待执行超出启动窗口，本期未启动");
      if (observation.busy) return update;
    }
    if (!run.eventId) {
      const room = await readRoom(app, roomId);
      if (
        !room.agents.some(
          (a) => a.joined && a.id === agentId && a.userId === agent.userId,
        )
      )
        return result("blocked", "当前成员未加入本次工作，未派发工作");
      const time = new Intl.DateTimeFormat("zh-CN", {
        timeZone: task.rule.timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(run.scheduledAt));
      const posted = await postConversation(app, {
        roomId: roomId,
        text: `【${run.manual ? "手动运行" : "定时任务"} · ${task.title}】\n计划时间：${time}（${task.rule.timeZone}）\n\n${task.prompt}`,
        transactionId: run.id,
      });
      if (!posted.ok) return result("blocked", posted.error);
      run = await app.schedules.recordEvent(id, posted.eventId);
    }
    const asked = await askConversation(
      app,
      {
        roomId: roomId,
        eventId: run.eventId!,
        agentId,
        runtimeMode: "manual",
        runtime: task.runtime,
        useMemory: task.useMemory,
        useKnowledge: task.useKnowledge,
        executionMode: "task",
        scheduledRunId: run.id,
        silentNoUpdate: task.silentNoUpdate,
        timeoutMs: task.timeoutMinutes * 60000,
      },
      task.runtime ?? undefined,
    );
    const latest = await observe();
    if (latest.job || latest.active || latest.queued) return project(latest);
    return result(
      asked.ok
        ? "preparing"
        : asked.submission === "not_submitted"
          ? "failed"
          : "unknown",
      asked.ok ? null : asked.error,
    );
  } catch {
    throw new ApplicationError("原工作协调尚未确认，继续观察同一请求。");
  }
}
