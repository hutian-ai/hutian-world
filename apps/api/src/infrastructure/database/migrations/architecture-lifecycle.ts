import type { MigrationInterface, QueryRunner } from "typeorm";
export class ArchitectureLifecycle1794931200000 implements MigrationInterface {
  name = "ArchitectureLifecycle1794931200000";
  async up(sql: QueryRunner) {
    await sql.query(`CREATE TABLE chat_effects (
      request_id uuid PRIMARY KEY REFERENCES chat_requests(id),
      workspace_id uuid NOT NULL REFERENCES workspaces(id),
      reply_event_id text NOT NULL,
      state varchar(20) NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','completed','attention')),
      attempts integer NOT NULL DEFAULT 0, error_code integer,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    ); CREATE INDEX chat_effects_pending ON chat_effects(next_attempt_at) WHERE state='pending';
    ALTER TABLE chat_requests ADD COLUMN observe_attempts integer NOT NULL DEFAULT 0,
      ADD COLUMN next_observe_at timestamptz;
    ALTER TABLE scheduled_runs ADD COLUMN observe_attempts integer NOT NULL DEFAULT 0,
      ADD COLUMN next_observe_at timestamptz;`);
  }
  async down() {
    throw new Error(
      "Preserve request effects and original execution associations; use an explicit recovery plan.",
    );
  }
}
