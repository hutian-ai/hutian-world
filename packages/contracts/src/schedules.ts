import { z } from "zod";
import { Temporal } from "temporal-polyfill";
import type { RecordAuthority, RunAuthority } from "./access.js";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const scheduleRule = z.object({
  startDate: date, localTime: time, additionalTimes: z.array(time).max(7).default([]),
  timeZone: z.string().min(1).max(100).default("Asia/Shanghai"),
  frequency: z.enum(["once", "daily", "weekly", "monthly", "interval_days"]),
  interval: z.number().int().min(1).max(365).default(1),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  monthDay: z.union([z.number().int().min(1).max(31), z.literal("last")]).optional(),
  endDate: date.optional(),
}).strict().superRefine((rule, context) => {
  if (rule.frequency === "weekly" && !rule.weekdays?.length) context.addIssue({ code: "custom", message: "请选择执行星期" });
  if (rule.endDate && rule.endDate < rule.startDate) context.addIssue({ code: "custom", message: "结束日期不能早于开始日期" });
  if (rule.frequency === "once" && rule.additionalTimes.length) context.addIssue({ code: "custom", message: "一次性安排只选择一个启动时间" });
  try {
    Temporal.PlainDateTime.from(`${rule.startDate}T${rule.localTime}`).toZonedDateTime(rule.timeZone);
    if (rule.endDate) Temporal.PlainDate.from(rule.endDate);
  } catch { context.addIssue({ code: "custom", message: "日期或时区无效" }); }
});
export type ScheduleRule = z.infer<typeof scheduleRule>;
export const scheduleInput = z.object({
  id: z.uuid(), title: z.string().trim().min(1).max(120), prompt: z.string().trim().min(1).max(15000),
  roleId: z.uuid(), roomId: z.string().startsWith("!").max(500),
  runtime: z.object({ nodeId: z.uuid(), provider: z.string().min(1).max(128), label: z.string().min(1).max(200).default("已配置 Runtime") }).strict(),
  rule: scheduleRule, enabled: z.boolean().default(false),
  silentNoUpdate: z.boolean().default(false),
  useMemory: z.boolean().default(false), useKnowledge: z.boolean().default(false),
  timeoutMinutes: z.number().int().min(3).max(60).default(30),
  startWindowMinutes: z.number().int().min(1).max(1440).default(60),
  sourceAutomationId: z.string().regex(/^[a-z0-9-]{1,80}$/).nullable().default(null),
}).strict();
export type ScheduleInput = z.infer<typeof scheduleInput>;
export interface ScheduledTask extends ScheduleInput { authority: RecordAuthority & Omit<RunAuthority, "requestedByUserId">; status: "active" | "paused" | "ended" | "deleted"; revision: number; nextStartAt: string | null; deletedAt: string | null; createdAt: string; updatedAt: string }
export interface ScheduleCalendarItem {
  id: string; scheduleId: string; runId: string | null; at: string; title: string;
  kind: "expected" | "run"; state: ScheduledRunState | null; roleId: string;
}
export const scheduleCalendarQuery = z.object({
  from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }),
  query: z.string().max(120).default(""), roleId: z.union([z.uuid(), z.literal("")]).default(""),
  scheduleId: z.union([z.uuid(), z.literal("")]).default(""),
  status: z.enum(["all", "active", "paused", "ended"]).default("all"),
}).strict().refine(value => Date.parse(value.to) > Date.parse(value.from) && Date.parse(value.to) - Date.parse(value.from) <= 62 * 86400000, "请选择 62 天以内的日历范围");
export type ScheduledRunState = "queued" | "preparing" | "running" | "blocked" | "replied" | "failed" | "unknown" | "missed" | "skipped";
export interface ScheduledRun {
  authority: RunAuthority;
  id: string; scheduleId: string; scheduledAt: string; manual: boolean; state: ScheduledRunState;
  snapshot: ScheduleInput; eventId: string | null; runId: string | null; replyEventId: string | null;
  error: string | null; createdAt: string; updatedAt: string;
}
export const scheduledRunUpdate = z.object({
  state: z.enum(["queued", "preparing", "running", "blocked", "replied", "failed", "unknown", "missed", "skipped"]),
  runId: z.uuid().nullable(), replyEventId: z.string().startsWith("$").max(500).nullable(),
  error: z.string().max(1000).nullable(),
}).strict();
