import { Inject, Injectable } from "@nestjs/common";
import type { Workspace } from "@hutian-world/contracts";
import { AccessContexts } from "../access/access-context.service.js";
import { RolesService } from "../roles/roles.service.js";
import { ProjectsService } from "../projects/projects.service.js";
@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
    @Inject(RolesService) private readonly roles: RolesService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  async overview(): Promise<Workspace> {
    const [creator, roles, projects] = await Promise.all([
      this.contexts.creator(),
      this.roles.list(),
      this.projects.list(),
    ]);
    return {
      access: this.contexts.current(),
      creator: { id: creator.id, displayName: creator.displayName },
      roles,
      projects,
    };
  }
}
