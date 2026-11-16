import type {
  ScheduleRule,
  ScheduledRun,
  ScheduledTask,
} from "@hutian-world/contracts";

export const scheduleStateLabels: Record<ScheduledRun["state"], string> = {
  queued: "等待执行",
  preparing: "正在准备",
  running: "执行中",
  waiting_permission: "等待授权",
  blocked: "等待可用条件",
  replied: "已回复",
  failed: "执行失败",
  unknown: "结果待核对",
  missed: "已错过",
  skipped: "无需新报告",
};
export const scheduleStatusLabels: Record<ScheduledTask["status"], string> = {
  active: "已启用",
  paused: "已暂停",
  ended: "已结束",
  deleted: "已删除",
};
export const frequencyLabels = {
  once: "仅一次",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  interval_days: "每隔 N 天",
};
export function scheduleAt(value: string | null, timeZone = "Asia/Shanghai") {
  return value
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
      }).format(new Date(value))
    : "没有后续执行";
}
export function scheduleSummary(rule: ScheduleRule) {
  const weekdays = rule.weekdays ?? [];
  const days = ["一", "二", "三", "四", "五", "六", "日"];
  const repeat =
    rule.frequency === "weekly"
      ? weekdays.join(",") === "1,2,3,4,5"
        ? "周一至周五"
        : weekdays.length === 7
          ? "每天"
          : weekdays.map((day) => "周" + days[day - 1]).join("、")
      : rule.frequency === "interval_days"
        ? `每 ${rule.interval} 天`
        : rule.frequency === "monthly"
          ? `每月${rule.monthDay === "last" ? "最后一天" : `${rule.monthDay ?? 1} 日`}`
          : rule.frequency === "once"
            ? rule.startDate
            : frequencyLabels[rule.frequency];
  return `${repeat} · ${[rule.localTime, ...rule.additionalTimes].sort().join(" / ")}`;
}
export function scheduleReturnTo(value?: string | null) {
  return value && /^\/schedules(?:\?[^#]*)?$/.test(value)
    ? value
    : "/schedules";
}
export function scheduleHref(id: string, returnTo: string, edit = false) {
  return `/schedules/${id}${edit ? "/edit" : ""}?${new URLSearchParams({ returnTo: scheduleReturnTo(returnTo) })}`;
}
export function scheduledWorkReturnTo(value?: string | null) {
  return value && /^\/schedules(?:\/[\da-f-]{36})?(?:\?[^#]*)?$/.test(value)
    ? value
    : null;
}
export function scheduledWorkHref(id: string, returnTo?: string) {
  const params = new URLSearchParams({ run: id });
  const back = scheduledWorkReturnTo(returnTo);
  if (back) params.set("returnTo", back);
  return `/inbox?${params}`;
}
