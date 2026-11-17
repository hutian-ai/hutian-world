import type { MigrationInterface, QueryRunner } from "typeorm";
export class RuntimeDeviceSettings1794888000000 implements MigrationInterface {
  name = "RuntimeDeviceSettings1794888000000";
  async up(query: QueryRunner) {
    await query.query(`CREATE TABLE runtime_device_settings (
      workspace_id uuid NOT NULL,
      connection_id uuid NOT NULL,
      source_key varchar(64) NOT NULL,
      node_id uuid NOT NULL,
      custom_name varchar(80),
      version integer NOT NULL CHECK (version > 0),
      updated_by uuid NOT NULL REFERENCES app_users(id),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (workspace_id, connection_id, source_key, node_id),
      FOREIGN KEY (workspace_id, connection_id) REFERENCES module_connections(workspace_id, id),
      CHECK (custom_name IS NULL OR (length(trim(custom_name)) > 0 AND custom_name = trim(custom_name)))
    )`);
  }
  async down() {
    throw new Error("设备名称需保留，请先备份并人工核对。");
  }
}
