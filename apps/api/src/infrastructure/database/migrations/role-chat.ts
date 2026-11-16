import type { MigrationInterface, QueryRunner } from "typeorm";

export class RoleChatIdentity1794531600000 implements MigrationInterface {
  name = "RoleChatIdentity1794531600000";
  async up(query: QueryRunner) {
    await query.query(`
      CREATE TABLE role_chat_identities (
        role_id uuid PRIMARY KEY REFERENCES roles(id),
        agent_id varchar(50) NOT NULL UNIQUE,
        user_id varchar(500) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }
  async down() {
    throw new Error("通信身份需要保留，请先备份并人工核对。");
  }
}
