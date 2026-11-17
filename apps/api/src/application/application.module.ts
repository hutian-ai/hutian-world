import { Module } from "@nestjs/common";
import { DatabaseModule } from "../infrastructure/database/database.module.js";
import { AccessModule } from "../modules/access/access.module.js";
import { ChatRequestsModule } from "../modules/chat-requests/chat-requests.module.js";
import { ProjectsModule } from "../modules/projects/projects.module.js";
import { RolesModule } from "../modules/roles/roles.module.js";
import { RuntimeDevicesModule } from "../modules/runtime-devices/runtime-devices.module.js";
import { SchedulesModule } from "../modules/schedules/schedules.module.js";
import { WorkspaceModule } from "../modules/workspace/workspace.module.js";
import { WorkbenchApplication } from "../transport/browser/application.service.js";
import { ConversationFeeds } from "../transport/browser/conversation-feeds.js";
import { EffectsController } from "../transport/browser/effects.controller.js";
import { RolesController } from "../transport/browser/roles.controller.js";
import { WorkbenchTransportController } from "../transport/browser/transport.controller.js";
import { WorkbenchController } from "../transport/browser/workbench.controller.js";
import { ApplicationServices } from "./application-services.js";
import { ChatCoordinator } from "./coordination/chat-coordinator.js";
import { ChatEffects } from "./coordination/chat-effects.js";
import { SchedulesRunner } from "./coordination/schedules.runner.js";
import { ExecutionApplication } from "./execution.application.js";
@Module({
  imports: [
    DatabaseModule,
    RuntimeDevicesModule,
    AccessModule,
    WorkspaceModule,
    RolesModule,
    ProjectsModule,
    SchedulesModule,
    ChatRequestsModule,
  ],
  providers: [
    ConversationFeeds,
    ChatEffects,
    ApplicationServices,
    WorkbenchApplication,
    ExecutionApplication,
    ChatCoordinator,
    SchedulesRunner,
  ],
  exports: [ChatEffects, ChatCoordinator, SchedulesRunner],
  controllers: [
    EffectsController,
    RolesController,
    WorkbenchController,
    WorkbenchTransportController,
  ],
})
export class ApplicationModule {}
