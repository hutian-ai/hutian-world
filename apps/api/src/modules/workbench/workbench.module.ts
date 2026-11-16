import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { RolesModule } from "../roles/roles.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { SchedulesModule } from "../schedules/schedules.module.js";
import { ChatRequestsModule } from "../chat-requests/chat-requests.module.js";
import { WorkbenchApplication } from "./application.service.js";
import { WorkbenchController } from "./workbench.controller.js";
import { WorkbenchTransportController } from "./transport.controller.js";
@Module({
  imports: [
    AccessModule,
    WorkspaceModule,
    RolesModule,
    ProjectsModule,
    SchedulesModule,
    ChatRequestsModule,
  ],
  providers: [WorkbenchApplication],
  controllers: [WorkbenchController, WorkbenchTransportController],
})
export class WorkbenchModule {}
