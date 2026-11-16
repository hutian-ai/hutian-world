import { Inject, Injectable, Module } from "@nestjs/common";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { ConfigModule } from "../../config/config.module.js";
import type { Environment } from "../../config/environment.js";
@Injectable()
export class WorkflowsService {
  private started = false;
  constructor(@Inject("ENV") private readonly env: Environment) {}
  async start() {
    DBOS.setConfig({
      name: "hutian-world-chat",
      systemDatabaseUrl: this.env.HUTIAN_DATABASE_URL,
      systemDatabaseSchemaName: "dbos_chat",
      systemDatabasePoolSize: 3,
      applicationVersion: "chat-v1",
      logLevel: "warn",
    });
    try {
      await DBOS.launch();
      this.started = true;
    } catch (error) {
      await DBOS.shutdown();
      throw error;
    }
  }
  async beforeApplicationShutdown() {
    if (this.started) await DBOS.shutdown();
  }
}
@Module({
  imports: [ConfigModule],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
