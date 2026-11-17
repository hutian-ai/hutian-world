import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { RolesModule } from "../roles/roles.module.js";
import { WorkspaceController } from "./workspace.controller.js";
import { WorkspaceService } from "./workspace.service.js";
@Module({
  imports: [AccessModule, ProjectsModule, RolesModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
