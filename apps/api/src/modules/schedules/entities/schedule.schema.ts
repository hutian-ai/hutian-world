import { EntitySchema } from "typeorm";
import type { TaskRow, RunRow } from "../schedules.mapper.js";
const uuid = { type: "uuid" as const };
const timestamp = { type: "timestamptz" as const };
const authority = {
  workspace_id: uuid,
  run_as_user_id: uuid,
  communication_connection_id: uuid,
  runtime_connection_id: uuid,
};
const dates = {
  created_at: { ...timestamp, default: () => "now()" },
  updated_at: { ...timestamp, default: () => "now()" },
};
export const ScheduledTaskSchema = new EntitySchema<TaskRow>({
  name: "ScheduledTask",
  tableName: "scheduled_tasks",
  columns: {
    id: { ...uuid, primary: true },
    ...authority,
    creator_id: uuid,
    role_id: uuid,
    created_by_user_id: uuid,
    definition: { type: "jsonb" },
    revision: { type: "integer", default: 1 },
    enabled: { type: "boolean", default: false },
    source_automation_id: { type: "varchar", length: 80, nullable: true },
    next_start_at: { ...timestamp, nullable: true },
    deleted_at: { ...timestamp, nullable: true },
    ...dates,
  },
});
export const ScheduledRunSchema = new EntitySchema<RunRow>({
  name: "ScheduledRun",
  tableName: "scheduled_runs",
  columns: {
    id: { ...uuid, primary: true },
    ...authority,
    requested_by_user_id: uuid,
    schedule_id: uuid,
    scheduled_at: timestamp,
    manual: { type: "boolean", default: false },
    snapshot: { type: "jsonb" },
    state: { type: "varchar", length: 20 },
    event_id: { type: "text", nullable: true },
    run_id: { ...uuid, nullable: true },
    reply_event_id: { type: "text", nullable: true },
    error: { type: "text", nullable: true },
    lease_until: { ...timestamp, nullable: true },
    ...dates,
  },
});
