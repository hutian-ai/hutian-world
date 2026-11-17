import { projectInput } from "@hutian-world/contracts";
import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
@Controller(["v1", "v2"])
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly service: ProjectsService,
  ) {}
  @Post("projects") createProject(@Body() body: unknown) {
    return this.service.createProject(projectInput.parse(body));
  }
  @Patch("projects/:id") updateProject(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateProject(id, projectInput.parse(body));
  }
  @Put("projects/:projectId/roles/:roleId") addRole(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("roleId", new ParseUUIDPipe()) roleId: string,
  ) {
    return this.service.membership(projectId, roleId, false);
  }
  @Delete("projects/:projectId/roles/:roleId") removeRole(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("roleId", new ParseUUIDPipe()) roleId: string,
  ) {
    return this.service.membership(projectId, roleId, true);
  }
}
