import { RuntimeDevicesModule } from "../runtime-devices/runtime-devices.module.js";
import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { RolesService } from "./roles.service.js";
import { RolesController } from "./roles.controller.js";
@Module({
  imports: [RuntimeDevicesModule, AccessModule, ProjectsModule, DatabaseModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
