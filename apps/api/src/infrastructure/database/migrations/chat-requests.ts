import type { MigrationInterface, QueryRunner } from "typeorm";
export class ChatRequests1794771000000 implements MigrationInterface {
  name = "ChatRequests1794771000000";
  async up(sql: QueryRunner) {
    await sql.query(`CREATE TABLE chat_requests (
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL, requested_by_user_id uuid NOT NULL,
      communication_connection_id uuid NOT NULL, runtime_connection_id uuid NOT NULL,
      snapshot jsonb NOT NULL, state varchar(30) NOT NULL DEFAULT 'accepted', run_id uuid, reply_event_id text,
      workflow_started boolean NOT NULL DEFAULT false, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      FOREIGN KEY(workspace_id,requested_by_user_id) REFERENCES workspace_members(workspace_id,user_id),
      FOREIGN KEY(workspace_id,communication_connection_id) REFERENCES module_connections(workspace_id,id),
      FOREIGN KEY(workspace_id,runtime_connection_id) REFERENCES module_connections(workspace_id,id)
    ); CREATE INDEX chat_requests_pending_workflow ON chat_requests(created_at) WHERE NOT workflow_started;
    CREATE UNIQUE INDEX chat_requests_source ON chat_requests(workspace_id,communication_connection_id,(snapshot->>'roomId'),(snapshot->>'eventId'),(snapshot->>'agentId'));`);
  }
  async down() {
    throw new Error("聊天请求和原执行关联应保留，请备份后人工核对。");
  }
}
