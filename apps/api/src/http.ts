import {
  Body, Catch, Controller, Delete, Get, Inject, Param, Patch, Post, Put, ParseUUIDPipe,
  Injectable, UnauthorizedException, HttpException,
} from "@nestjs/common";
import type { ArgumentsHost, CanActivate, ExceptionFilter, ExecutionContext } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { projectInput, roleInput, createRoleInput, roleChatIdentityInput, roleRuntimeBindingInput } from "@hutian-world/contracts";
import type { Environment } from "./environment.js";
import { WorkspaceService } from "./workspace.service.js";

@Injectable()
export class LocalApiGuard implements CanActivate {
  constructor(@Inject("ENV") private readonly env: Environment) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const supplied = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from("Bearer " + this.env.HUTIAN_API_TOKEN);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new UnauthorizedException("需要有效的应用凭据");
    return true;
  }
}
@Catch()
export class PublicErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500, message = "操作暂时未完成，请刷新后核对当前记录。";
    if (error instanceof ZodError) { status = 400; message = error.issues.map(i => i.message).join("；"); }
    else if (error instanceof HttpException) { status = error.getStatus(); message = error.message; }
    // QueryFailedError details can contain submitted content. Do not forward raw SQL or environment.
    if (status === 500) console.error("应用操作失败；未向客户端输出数据库或配置详情。");
    host.switchToHttp().getResponse<FastifyReply>().status(status).send({ message });
  }
}
@Controller("v1")
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly service: WorkspaceService) {}
  @Get("workspace") overview() { return this.service.overview(); }
  @Post("projects") createProject(@Body() body: unknown) { return this.service.createProject(projectInput.parse(body)); }
  @Patch("projects/:id") updateProject(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: unknown) { return this.service.updateProject(id, projectInput.parse(body)); }
  @Post("roles") createRole(@Body() body: unknown) { return this.service.createRole(createRoleInput.parse(body)); }
  @Patch("roles/:id") updateRole(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: unknown) { return this.service.updateRole(id, roleInput.parse(body)); }
  @Put("roles/:id/chat-identity") bindRoleChat(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: unknown) { return this.service.bindRoleChat(id, roleChatIdentityInput.parse(body)); }
  @Put("roles/:id/runtime") setRoleRuntime(@Param("id", new ParseUUIDPipe()) id: string, @Body() body: unknown) { return this.service.setRoleRuntime(id, roleRuntimeBindingInput.parse(body)); }
  @Put("projects/:projectId/roles/:roleId") addRole(@Param("projectId", new ParseUUIDPipe()) projectId: string, @Param("roleId", new ParseUUIDPipe()) roleId: string) { return this.service.membership(projectId, roleId, false); }
  @Delete("projects/:projectId/roles/:roleId") removeRole(@Param("projectId", new ParseUUIDPipe()) projectId: string, @Param("roleId", new ParseUUIDPipe()) roleId: string) { return this.service.membership(projectId, roleId, true); }
}
