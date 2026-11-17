import type { MigrationInterface, QueryRunner } from "typeorm";
export class ChatEffectRecovery1794931200001 implements MigrationInterface {
  name = "ChatEffectRecovery1794931200001";
  async up(query: QueryRunner) {
    await query.query(
      "ALTER TABLE chat_effects ADD COLUMN generation integer NOT NULL DEFAULT 0",
    );
  }
  async down() {
    throw new Error(
      "Preserve extraction retry generations; use an explicit recovery plan.",
    );
  }
}
