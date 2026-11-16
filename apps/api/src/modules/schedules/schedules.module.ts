import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { ChatHostModule } from "../../infrastructure/chat-host/chat-host.module.js";
import { SchedulesService } from "./schedules.service.js";
import { SchedulesRunner } from "./schedules.runner.js";
import { SchedulesController } from "./schedules.controller.js";
@Module({
  imports: [AccessModule, DatabaseModule, ChatHostModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulesRunner],
  exports: [SchedulesRunner, SchedulesService],
})
export class SchedulesModule {}
