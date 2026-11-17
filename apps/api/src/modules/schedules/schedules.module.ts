import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { AccessModule } from "../access/access.module.js";
import { RuntimeDevicesModule } from "../runtime-devices/runtime-devices.module.js";
import { ScheduleNoticesRepository } from "./schedule-notices.repository.js";
import { SchedulesController } from "./schedules.controller.js";
import { SchedulesService } from "./schedules.service.js";
@Module({
  imports: [RuntimeDevicesModule, AccessModule, DatabaseModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleNoticesRepository],
  exports: [SchedulesService],
})
export class SchedulesModule {}
