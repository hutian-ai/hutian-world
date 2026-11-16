import {
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  ParseUUIDPipe,
} from "@nestjs/common";
import { projectInput } from "@hutian-world/contracts";
import { ProjectsService } from "./projects.service.js";
@Controller("v1")
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
