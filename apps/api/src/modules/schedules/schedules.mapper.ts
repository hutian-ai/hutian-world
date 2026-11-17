import type {
  ScheduleInput,
  ScheduledRun,
  ScheduledRunSnapshot,
  ScheduledTask,
} from "@hutian-world/contracts";
import { scheduleInput } from "@hutian-world/contracts";
import { nextScheduleStart } from "@hutian-world/contracts/schedule-time";
export type AuthorityRow = {
  workspace_id: string;
  run_as_user_id: string;
  communication_connection_id: string;
  runtime_connection_id: string;
};
export type TaskRow = AuthorityRow & {
  id: string;
  creator_id: string;
  role_id: string;
  source_automation_id: string | null;
  created_by_user_id: string;
  definition: ScheduleInput;
  revision: number;
  enabled: boolean;
  next_start_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};
export type RunRow = AuthorityRow & {
  id: string;
  requested_by_user_id: string;
  schedule_id: string;
  scheduled_at: Date;
  manual: boolean;
  lease_until: Date | null;
  observe_attempts: number;
  next_observe_at: Date | null;
  state: ScheduledRun["state"];
  snapshot: ScheduledRunSnapshot;
  event_id: string | null;
  run_id: string | null;
  reply_event_id: string | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};
export const authority = (r: AuthorityRow) => ({
  workspaceId: r.workspace_id,
  runAsUserId: r.run_as_user_id,
  communicationConnectionId: r.communication_connection_id,
  runtimeConnectionId: r.runtime_connection_id,
});
export const taskView = (r: TaskRow): ScheduledTask => ({
  ...scheduleInput.strip().parse(r.definition),
  id: r.id,
  enabled: r.enabled,
  authority: { ...authority(r), createdByUserId: r.created_by_user_id },
  status: r.deleted_at
    ? "deleted"
    : r.enabled
      ? "active"
      : nextScheduleStart(r.definition.rule, new Date().toISOString())
        ? "paused"
        : "ended",
  revision: r.revision,
  nextStartAt: r.next_start_at?.toISOString() ?? null,
  deletedAt: r.deleted_at?.toISOString() ?? null,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});
export const runView = (r: RunRow): ScheduledRun => ({
  id: r.id,
  scheduleId: r.schedule_id,
  authority: { ...authority(r), requestedByUserId: r.requested_by_user_id },
  scheduledAt: r.scheduled_at.toISOString(),
  manual: r.manual,
  state: r.state,
  snapshot: r.snapshot,
  eventId: r.event_id,
  runId: r.run_id,
  replyEventId: r.reply_event_id,
  error: r.error,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});
