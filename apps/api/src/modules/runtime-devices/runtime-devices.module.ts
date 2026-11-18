import { RuntimeActivityRepository } from "./runtime-activity.repository.js";
import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { AccessModule } from "../access/access.module.js";
import { RuntimeDevicesService } from "./runtime-devices.service.js";
@Module({
  imports: [AccessModule, DatabaseModule],
  providers: [RuntimeDevicesService, RuntimeActivityRepository],
  exports: [RuntimeDevicesService, RuntimeActivityRepository],
})
export class RuntimeDevicesModule {}
