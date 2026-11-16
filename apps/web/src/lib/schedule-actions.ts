import { command } from "./api";
export type * from "@hutian-world/contracts";
export const loadSchedules = command("schedule-actions.loadSchedules");
export const loadSchedule = command("schedule-actions.loadSchedule");
export const loadScheduledRun = command("schedule-actions.loadScheduledRun");
export const deleteSchedule = command("schedule-actions.deleteSchedule");
export const loadScheduleCalendar = command(
  "schedule-actions.loadScheduleCalendar",
);
export const saveSchedule = command("schedule-actions.saveSchedule");
export const toggleSchedule = command("schedule-actions.toggleSchedule");
export const runSchedule = command("schedule-actions.runSchedule");
export const previewScheduleRule = command(
  "schedule-actions.previewScheduleRule",
);
export const readScheduledResult = command(
  "schedule-actions.readScheduledResult",
);
