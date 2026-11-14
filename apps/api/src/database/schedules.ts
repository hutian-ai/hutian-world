import type { MigrationInterface, QueryRunner } from "typeorm";
export class ScheduledTasks1794690000000 implements MigrationInterface {
  name = "ScheduledTasks1794690000000";
  async up(query: QueryRunner) {
    await query.query(`CREATE TABLE scheduled_tasks (
      id uuid PRIMARY KEY, creator_id uuid NOT NULL REFERENCES creators(id), role_id uuid NOT NULL REFERENCES roles(id),
      definition jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, enabled boolean NOT NULL DEFAULT false,
      source_automation_id varchar(80), next_start_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (creator_id, source_automation_id)
    )`);
    await query.query(`CREATE TABLE scheduled_runs (
      id uuid PRIMARY KEY, schedule_id uuid NOT NULL REFERENCES scheduled_tasks(id),
      scheduled_at timestamptz NOT NULL, manual boolean NOT NULL DEFAULT false, snapshot jsonb NOT NULL,
      state varchar(20) NOT NULL CHECK (state IN ('queued','preparing','running','blocked','replied','failed','unknown','missed')),
      event_id text, run_id uuid, reply_event_id text, error text, lease_until timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await query.query(`CREATE UNIQUE INDEX scheduled_runs_slot ON scheduled_runs(schedule_id, scheduled_at) WHERE NOT manual`);
    await query.query(`CREATE INDEX scheduled_tasks_due ON scheduled_tasks(next_start_at) WHERE enabled`);
  }
  async down() { throw new Error("定时安排与运行记录需保留，请先备份并人工核对。"); }
}

export class ScheduledNoUpdate1794690001000 implements MigrationInterface {
  name = "ScheduledNoUpdate1794690001000";
  async up(query: QueryRunner) {
    await query.query("ALTER TABLE scheduled_runs DROP CONSTRAINT scheduled_runs_state_check");
    await query.query("ALTER TABLE scheduled_runs ADD CONSTRAINT scheduled_runs_state_check CHECK (state IN ('queued','preparing','running','blocked','replied','failed','unknown','missed','skipped'))");
  }
  async down() { throw new Error("跳过记录需保留，请先核对原运行。"); }
}

export class ScheduledTaskDeletion1794690002000 implements MigrationInterface {
  name = "ScheduledTaskDeletion1794690002000";
  async up(query: QueryRunner) { await query.query("ALTER TABLE scheduled_tasks ADD COLUMN deleted_at timestamptz"); }
  async down() { throw new Error("删除标记和运行历史需保留，请先人工核对。"); }
}
