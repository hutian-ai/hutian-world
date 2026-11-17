import { EntitySchema } from "typeorm";
export interface ScheduleNoticeRow {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: "result" | "attention" | "failed";
  state_key: string;
  read_at: Date | null;
  resolved_at: Date | null;
  updated_at: Date;
}
export const ScheduleNoticeSchema = new EntitySchema<ScheduleNoticeRow>({
  name: "ScheduleNotice",
  tableName: "scheduled_run_notices",
  columns: {
    id: { type: "uuid", primary: true },
    workspace_id: { type: "uuid" },
    user_id: { type: "uuid" },
    kind: { type: "varchar", length: 20 },
    state_key: { type: "varchar", length: 20 },
    read_at: { type: "timestamptz", nullable: true },
    resolved_at: { type: "timestamptz", nullable: true },
    updated_at: { type: "timestamptz", default: () => "now()" },
  },
});
