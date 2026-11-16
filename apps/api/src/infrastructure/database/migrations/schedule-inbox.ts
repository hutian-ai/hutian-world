import type { MigrationInterface, QueryRunner } from "typeorm";

export class ScheduleInbox1794840000000 implements MigrationInterface {
  name = "ScheduleInbox1794840000000";
  async up(query: QueryRunner) {
    await query.query(`CREATE TABLE scheduled_run_notices (
      id uuid PRIMARY KEY REFERENCES scheduled_runs(id),
      workspace_id uuid NOT NULL REFERENCES workspaces(id),
      user_id uuid NOT NULL REFERENCES app_users(id),
      kind varchar(20) NOT NULL CHECK (kind IN ('result','attention','failed')),
      state_key varchar(20) NOT NULL,
      read_at timestamptz, resolved_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await query.query(`CREATE INDEX scheduled_run_notices_inbox
      ON scheduled_run_notices(workspace_id, user_id, updated_at DESC)`);
    // Historical replies remain accessible without announcing every old run as new.
    await query.query(`INSERT INTO scheduled_run_notices
      (id,workspace_id,user_id,kind,state_key,read_at,resolved_at,updated_at)
      SELECT id,workspace_id,requested_by_user_id,
        CASE WHEN state='replied' THEN 'result' ELSE 'failed' END,state,
        now(),NULL,updated_at FROM scheduled_runs WHERE state IN ('replied','failed','missed')`);
  }
  async down() {
    throw new Error("通知已读状态与原运行记录需保留，请先人工核对。");
  }
}
