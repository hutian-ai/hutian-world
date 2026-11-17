import { Inject, Injectable } from "@nestjs/common";
import { AccessContexts } from "../modules/access/access-context.service.js";
import { ChatRequestsService } from "../modules/chat-requests/chat-requests.service.js";
import { ProjectsService } from "../modules/projects/projects.service.js";
import { RolesService } from "../modules/roles/roles.service.js";
import { RuntimeDevicesService } from "../modules/runtime-devices/runtime-devices.service.js";
import { SchedulesService } from "../modules/schedules/schedules.service.js";
import { WorkspaceService } from "../modules/workspace/workspace.service.js";

/** Explicit composition dependencies. Never installed in a process-global registry. */
@Injectable()
export class ApplicationServices {
  constructor(
    @Inject(AccessContexts) readonly contexts: AccessContexts,
    @Inject(WorkspaceService) readonly workspace: WorkspaceService,
    @Inject(RolesService) readonly roles: RolesService,
    @Inject(ProjectsService) readonly projects: ProjectsService,
    @Inject(SchedulesService) readonly schedules: SchedulesService,
    @Inject(ChatRequestsService) readonly requests: ChatRequestsService,
    @Inject(RuntimeDevicesService) readonly devices: RuntimeDevicesService,
  ) {}
}
