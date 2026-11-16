import type { MigrationInterface, QueryRunner } from "typeorm";

export class RoleRuntimeBinding1794535200000 implements MigrationInterface {
  name = "RoleRuntimeBinding1794535200000";
  async up(query: QueryRunner) {
    await query.query(`
      CREATE TABLE role_runtime_bindings (
        role_id uuid PRIMARY KEY REFERENCES roles(id),
        node_id uuid NOT NULL,
        provider varchar(128) NOT NULL,
        label varchar(200) NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }
  async down() {
    throw new Error("执行配置需保留，请先备份并人工核对。");
  }
}
