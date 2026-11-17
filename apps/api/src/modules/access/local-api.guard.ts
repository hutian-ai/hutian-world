import type { AccessContext } from "@hutian-world/contracts";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import type { Environment } from "../../config/environment.js";
import { PUBLIC_HEALTH } from "../health/health.controller.js";
import { AccessContexts } from "./access-context.service.js";
import {
  BrowserSessions,
  SERVICE_ENDPOINT,
  SESSION_BOOTSTRAP,
  TOOL_ENDPOINT,
  browserOrigins,
} from "./browser-session.service.js";
@Injectable()
export class LocalApiGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(BrowserSessions) private readonly sessions: BrowserSessions,
    @Inject("ENV") private readonly env: Environment,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.get<boolean>(PUBLIC_HEALTH, context.getHandler()))
      return true;
    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { hutianAccess?: AccessContext }>();
    const supplied = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from("Bearer " + this.env.HUTIAN_API_TOKEN);
    const bootstrap = this.reflector.get<boolean>(
      SESSION_BOOTSTRAP,
      context.getHandler(),
    );
    const tool = this.reflector.get<boolean>(
      TOOL_ENDPOINT,
      context.getHandler(),
    );
    const bearer =
      supplied.length === expected.length &&
      timingSafeEqual(supplied, expected);
    if (
      this.reflector.getAllAndOverride<boolean>(SERVICE_ENDPOINT, [
        context.getHandler(),
        context.getClass(),
      ]) &&
      !bearer
    )
      throw new UnauthorizedException("此操作只接受服务端应用凭据。");
    const local = await this.contexts.local();
    if (
      !bearer &&
      !["127.0.0.1:3340", "127.0.0.1:3341"].includes(req.headers.host ?? "")
    )
      throw new UnauthorizedException("请使用本机工作台地址。");
    if (bootstrap) {
      if (
        req.headers["x-hutian-client"] !== "web" ||
        req.headers["sec-fetch-site"] !== "same-origin" ||
        (req.headers.origin && !browserOrigins.has(req.headers.origin))
      )
        throw new UnauthorizedException("请从本机工作台建立会话。");
    } else if (!tool && !bearer) {
      this.sessions.verify(req.headers.cookie, local);
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        (!req.headers.origin || !browserOrigins.has(req.headers.origin))
      )
        throw new UnauthorizedException("请求来源无效。");
    }
    if (
      req.headers["x-hutian-user-id"] ||
      req.headers["x-hutian-workspace-id"] ||
      req.headers["x-hutian-creator-id"]
    )
      throw new UnauthorizedException("本机模式不接受调用方指定身份或空间");
    req.hutianAccess = local;
    return true;
  }
}
