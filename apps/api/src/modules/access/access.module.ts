import { BrowserSessions } from "./browser-session.service.js";
import { BrowserSessionController } from "./browser-session.controller.js";
import { Module } from "@nestjs/common";
import { ConfigModule } from "../../config/config.module.js";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { AccessContexts } from "./access-context.service.js";
import { AccessController } from "./access.controller.js";
@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [AccessController, BrowserSessionController],
  providers: [AccessContexts, BrowserSessions],
  exports: [AccessContexts, BrowserSessions],
})
export class AccessModule {}
