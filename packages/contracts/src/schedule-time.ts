import rrule from "rrule";
import { Temporal } from "temporal-polyfill";
import { scheduleRule, type ScheduleRule } from "./schedules.js";
const { RRule } = rrule;
/** Adapted from the existing hutian recurrence module: floating RRULE fields + Temporal time zones. */
export function nextScheduleStart(input: ScheduleRule, from: string): string | null {
  const rule = scheduleRule.parse(input);
  const lower = Temporal.Instant.from(from);
  const candidates: string[] = [];
  const weekdays = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];
  const floating = (p: Temporal.PlainDateTime) => new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute));
  for (const localTime of new Set([rule.localTime, ...rule.additionalTimes])) {
    const start = Temporal.PlainDateTime.from(`${rule.startDate}T${localTime}`);
    const resolve = (wall: Temporal.PlainDateTime) => {
      const zoned = wall.toZonedDateTime(rule.timeZone, { disambiguation: "earlier" });
      return zoned.toPlainDateTime().equals(wall) ? zoned.toInstant() : null;
    };
    if (rule.frequency === "once") {
      const instant = resolve(start);
      if (instant && Temporal.Instant.compare(instant, lower) >= 0) candidates.push(instant.toString());
      continue;
    }
    const recurrence = new RRule({
      freq: rule.frequency === "weekly" ? RRule.WEEKLY : rule.frequency === "monthly" ? RRule.MONTHLY : RRule.DAILY,
      dtstart: floating(start), interval: rule.frequency === "interval_days" ? rule.interval : 1,
      ...(rule.frequency === "weekly" ? { byweekday: rule.weekdays!.map(d => weekdays[d - 1]!) } : {}),
      ...(rule.frequency === "monthly" ? { bymonthday: rule.monthDay === "last" ? -1 : (rule.monthDay ?? start.day) } : {}),
      ...(rule.endDate ? { until: floating(Temporal.PlainDateTime.from(`${rule.endDate}T23:59`)) } : {}),
    }, true);
    let cursor = lower.toZonedDateTimeISO(rule.timeZone).toPlainDateTime().subtract({ days: 1 });
    for (let attempt = 0; attempt < 8; attempt++) {
      const next = recurrence.after(floating(cursor), true);
      if (!next) break;
      const wall = Temporal.PlainDateTime.from({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: next.getUTCHours(), minute: next.getUTCMinutes() });
      const instant = resolve(wall);
      if (instant && Temporal.Instant.compare(instant, lower) >= 0) { candidates.push(instant.toString()); break; }
      cursor = wall.add({ minutes: 1 });
    }
  }
  return candidates.sort()[0] ?? null;
}
export function previewSchedule(rule: ScheduleRule, from = new Date().toISOString()) {
  const values: string[] = [];
  for (let i = 0; i < 5; i++) {
    const next = nextScheduleStart(rule, from);
    if (!next) break;
    values.push(next); from = new Date(Date.parse(next) + 1000).toISOString();
  }
  return values;
}
