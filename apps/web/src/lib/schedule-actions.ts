"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { scheduleInput, scheduleRule, scheduleCalendarQuery, type ScheduleCalendarItem, type ScheduledTask, type ScheduledRun } from "@hutian-world/contracts";
import { api, getWorkspace } from "./api";
import { readConversation } from "./communications";
function failure(error: unknown) {
  return { ok: false as const, error: error instanceof z.ZodError ? error.issues.map(i => i.message).join("；") : error instanceof Error ? error.message : "操作未确认，请重新读取原安排。" };
}
export async function loadSchedules() {
  try { return { ok: true as const, ...await api<{ tasks: ScheduledTask[]; runs: ScheduledRun[] }>("/v1/schedules") }; }
  catch (error) { return failure(error); }
}
export async function loadSchedule(id: string) {
  try { return { ok: true as const, ...await api<{ task: ScheduledTask; runs: ScheduledRun[] }>(`/v1/schedules/${z.uuid().parse(id)}`) }; }
  catch (error) { return failure(error); }
}
export async function loadScheduledRun(id: string) {
  try { return { ok: true as const, run: await api<ScheduledRun>(`/v1/scheduled-runs/${z.uuid().parse(id)}`) }; }
  catch (error) { return failure(error); }
}
export async function deleteSchedule(id: string, expectedRevision: number) {
  try { await api(`/v1/schedules/${z.uuid().parse(id)}`, "DELETE", { expectedRevision: z.number().int().positive().parse(expectedRevision) }); revalidatePath("/schedules"); return { ok: true as const }; }
  catch (error) { return failure(error); }
}
export async function loadScheduleCalendar(input: unknown) {
  try {
    const query = scheduleCalendarQuery.parse(input);
    return { ok: true as const, ...await api<{ items: ScheduleCalendarItem[]; timeZone: string }>(`/v1/schedules/calendar?${new URLSearchParams(query)}`) };
  } catch (error) { return failure(error); }
}
export async function saveSchedule(input: unknown, expectedRevision: number | null) {
  try {
    const task = scheduleInput.parse(input);
    const role = (await getWorkspace()).roles.find(r => r.id === task.roleId);
    if (!role?.chatIdentity) throw new Error("请先从成员页打开私聊或邀请成员，准备通信身份。");
    const room = await readConversation(task.roomId);
    if (!room.agents.some(a => a.joined && a.roleId === role.id)) throw new Error("请先邀请这位成员加入交付会话。");
    const saved = expectedRevision === null ? await api<ScheduledTask>("/v1/schedules", "POST", task) :
      await api<ScheduledTask>(`/v1/schedules/${task.id}`, "PUT", { task, expectedRevision: z.number().int().positive().parse(expectedRevision) });
    revalidatePath("/schedules");
    return { ok: true as const, task: saved };
  } catch (error) { return failure(error); }
}
export async function toggleSchedule(id: string, enabled: boolean, expectedRevision: number) {
  try { await api(`/v1/schedules/${z.uuid().parse(id)}/enabled`, "POST", { enabled: z.boolean().parse(enabled), expectedRevision: z.number().int().positive().parse(expectedRevision) }); revalidatePath("/schedules"); return { ok: true as const }; }
  catch (error) { return failure(error); }
}
export async function runSchedule(id: string, requestId: string) {
  try { const run = await api<ScheduledRun>(`/v1/schedules/${z.uuid().parse(id)}/run`, "POST", { requestId: z.uuid().parse(requestId) }); revalidatePath("/schedules"); return { ok: true as const, run }; }
  catch (error) { return failure(error); }
}
export async function previewScheduleRule(input: unknown) {
  try { return { ok: true as const, ...await api<{ starts: string[] }>("/v1/schedules/preview", "POST", scheduleRule.parse(input)) }; }
  catch (error) { return failure(error); }
}
export async function readScheduledResult(id: string) {
  try {
    const { scheduledResult } = await import("./report-attachments");
    const result = await scheduledResult(z.uuid().parse(id));
    return { ok: true as const, message: result.message, attachments: result.attachments };
  } catch (error) { return failure(error); }
}
