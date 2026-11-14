import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ScheduledRun } from "@hutian-world/contracts";
import { api, getWorkspace } from "@/lib/api";
import { readConversation } from "@/lib/communications";
import { askConversation, postConversation } from "@/lib/communication-actions";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const token = process.env.HUTIAN_API_TOKEN;
  const expected = Buffer.from(token ? `Bearer ${token}` : "");
  if (!token || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response(null, { status: 401 });
  try {
    const { id } = z.object({ id: z.uuid() }).strict().parse(await request.json());
    let run = await api<ScheduledRun>(`/v1/scheduled-runs/${id}`);
    const task = run.snapshot;
    const result = (state: ScheduledRun["state"], error: string | null = null, runId: string | null = run.runId, replyEventId: string | null = run.replyEventId) => Response.json({ state, error, runId, replyEventId });
    if (["replied", "failed", "missed", "skipped"].includes(run.state)) return result(run.state);
    const role = (await getWorkspace()).roles.find(r => r.id === task.roleId);
    if (!role?.chatIdentity) return result("blocked", "成员的通信身份尚未准备，请从成员页打开私聊或邀请成员后重试");
    let state = await readConversation(task.roomId);
    if (!state.agents.some(a => a.joined && a.id === role.chatIdentity!.agentId && a.userId === role.chatIdentity!.userId)) return result("blocked", "当前成员未加入交付会话，未派发工作");
    const job = run.eventId ? state.jobs.find(j => j.eventId === run.eventId && j.agentId === role.chatIdentity!.agentId) : undefined;
    const reply = run.eventId ? state.messages.find(m => m.replyTo === run.eventId && m.agentId === role.chatIdentity!.agentId) : undefined;
    if (job?.state === "skipped") return result("skipped", null, job.runId);
    if (reply) return result("replied", null, job?.runId ?? run.runId, reply.id);
    if (job && ["failed", "cancelled", "canceled"].includes(job.state)) return result("failed", job.error || "原运行未完成", job.runId);
    if (state.active) {
      const own = state.active.eventId === run.eventId && state.active.agentId === role.chatIdentity.agentId;
      return result(own ? "running" : job ? "unknown" : "blocked", own ? null : "执行宿主正在处理其他工作，本次等待可用入口", job?.runId ?? run.runId);
    }
    if (!job && Date.now() - Date.parse(run.scheduledAt) > task.startWindowMinutes * 60000)
      return result("missed", "等待执行超出启动窗口，未发送过期工作");
    if (!run.eventId) {
      const time = new Intl.DateTimeFormat("zh-CN", { timeZone: task.rule.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(run.scheduledAt));
      const posted = await postConversation({ roomId: task.roomId, text: `【${run.manual ? "手动运行" : "定时任务"} · ${task.title}】\n计划时间：${time}（${task.rule.timeZone}）\n\n${task.prompt}`, transactionId: run.id });
      if (!posted.ok) return result("blocked", posted.error);
      run = await api<ScheduledRun>(`/v1/scheduled-runs/${id}/event`, "PUT", { eventId: posted.eventId });
    }
    const asked = await askConversation({ roomId: task.roomId, eventId: run.eventId!, agentId: role.chatIdentity.agentId,
      runtimeMode: "manual", runtime: task.runtime, useMemory: task.useMemory, useKnowledge: task.useKnowledge,
      executionMode: "task", silentNoUpdate: task.silentNoUpdate, timeoutMs: task.timeoutMinutes * 60000, ...(job ? { resume: true } : {}),
    });
    state = await readConversation(task.roomId);
    const latest = state.jobs.find(j => j.eventId === run.eventId && j.agentId === role.chatIdentity!.agentId);
    const delivered = state.messages.find(m => m.replyTo === run.eventId && m.agentId === role.chatIdentity!.agentId);
    if (delivered) return result("replied", null, latest?.runId ?? run.runId, delivered.id);
    if (latest) return result(["failed", "cancelled", "canceled"].includes(latest.state) ? "failed" : state.active ? "running" : "unknown", latest.error, latest.runId);
    return result(asked.ok ? "preparing" : "blocked", asked.ok ? null : asked.error);
  } catch { return Response.json({ message: "原定时请求尚未确认，请沿原记录观察。" }, { status: 503 }); }
}
