import { WorkbenchModule } from "./modules/workbench/workbench.module.js";
import { Inject, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "./config/config.module.js";
import { DatabaseModule } from "./infrastructure/database/database.module.js";
import {
  WorkflowsModule,
  WorkflowsService,
} from "./infrastructure/workflows/workflows.module.js";
import { AccessModule } from "./modules/access/access.module.js";
import { LocalApiGuard } from "./modules/access/local-api.guard.js";
import { AccessContextInterceptor } from "./modules/access/access-context.interceptor.js";
import { PublicErrorFilter } from "./common/filters/public-error.filter.js";
import { WorkspaceModule } from "./modules/workspace/workspace.module.js";
import { RolesModule } from "./modules/roles/roles.module.js";
import { ProjectsModule } from "./modules/projects/projects.module.js";
import { ChatRequestsModule } from "./modules/chat-requests/chat-requests.module.js";
import { ChatRequestsService } from "./modules/chat-requests/chat-requests.service.js";
import { SchedulesModule } from "./modules/schedules/schedules.module.js";
import { SchedulesRunner } from "./modules/schedules/schedules.runner.js";
import { HealthModule } from "./modules/health/health.module.js";
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    WorkflowsModule,
    AccessModule,
    WorkspaceModule,
    RolesModule,
    ProjectsModule,
    ChatRequestsModule,
    SchedulesModule,
    HealthModule,
    WorkbenchModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: PublicErrorFilter },
    { provide: APP_GUARD, useClass: LocalApiGuard },
    { provide: APP_INTERCEPTOR, useClass: AccessContextInterceptor },
  ],
})
export class AppModule {
  constructor(
    @Inject(WorkflowsService) private readonly workflows: WorkflowsService,
    @Inject(ChatRequestsService) private readonly requests: ChatRequestsService,
    @Inject(SchedulesRunner) private readonly schedules: SchedulesRunner,
  ) {}
  async onApplicationBootstrap() {
    // All constructors registered their processors and local identity is ready.
    // Recover DBOS before starting producers; keep original names and IDs.
    await this.workflows.start();
    await this.requests.start();
    await this.schedules.start();
  }
}
