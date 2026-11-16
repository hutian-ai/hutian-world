import type { MigrationInterface, QueryRunner } from "typeorm";

export class ExecutionPreferences1794772000000 implements MigrationInterface {
  name = "ExecutionPreferences1794772000000";
  async up(query: QueryRunner) {
    await query.query(
      `ALTER TABLE role_runtime_bindings ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await query.query(`CREATE TABLE conversation_execution_preferences (
      workspace_id uuid NOT NULL REFERENCES workspaces(id),
      user_id uuid NOT NULL REFERENCES app_users(id),
      room_id varchar(500) NOT NULL,
      agent_id varchar(50) NOT NULL,
      override jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (workspace_id, user_id, room_id, agent_id)
    )`);
  }
  async down(query: QueryRunner) {
    await query.query("DROP TABLE conversation_execution_preferences");
    await query.query(
      "ALTER TABLE role_runtime_bindings DROP COLUMN preferences",
    );
  }
}
