import { Controller, Get, Inject, Req, Res, SetMetadata } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { AccessContexts } from "./access-context.service.js";
import {
  BrowserSessions,
  SESSION_BOOTSTRAP,
} from "./browser-session.service.js";
@Controller("api")
export class BrowserSessionController {
  constructor(
    @Inject(BrowserSessions) private readonly sessions: BrowserSessions,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  @SetMetadata(SESSION_BOOTSTRAP, true)
  @Get("session")
  establish(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const context = this.contexts.current();
    res.header(
      "Set-Cookie",
      `hutian_session=${this.sessions.issue(context)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.protocol === "https" ? "; Secure" : ""}`,
    );
    res.header("Cache-Control", "no-store");
    return { userId: context.userId, workspaceId: context.workspaceId };
  }
}
