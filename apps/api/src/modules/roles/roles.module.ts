import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { AccessModule } from "../access/access.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { RuntimeDevicesModule } from "../runtime-devices/runtime-devices.module.js";
import { RolesService } from "./roles.service.js";
@Module({
  imports: [RuntimeDevicesModule, AccessModule, ProjectsModule, DatabaseModule],
  controllers: [],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
