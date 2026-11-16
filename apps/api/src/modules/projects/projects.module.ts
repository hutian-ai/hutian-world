import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { ProjectsService } from "./projects.service.js";
import { ProjectsController } from "./projects.controller.js";
@Module({
  imports: [AccessModule, DatabaseModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
