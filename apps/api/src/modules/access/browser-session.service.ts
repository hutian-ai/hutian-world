import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AccessContext } from "@hutian-world/contracts";
import type { Environment } from "../../config/environment.js";
export const SESSION_BOOTSTRAP = "hutian_session_bootstrap";
export const SERVICE_ENDPOINT = "hutian_service_endpoint";
export const TOOL_ENDPOINT = "hutian_tool_endpoint";
export const browserOrigins = new Set([
  "http://127.0.0.1:3340",
  "http://127.0.0.1:3341",
]);
@Injectable()
export class BrowserSessions {
  constructor(@Inject("ENV") private readonly env: Environment) {}
  private sign(value: string) {
    return createHmac("sha256", this.env.HUTIAN_API_TOKEN)
      .update("hutian-browser-session:" + value)
      .digest("base64url");
  }
  issue(context: AccessContext) {
    const payload = Buffer.from(
      JSON.stringify({
        userId: context.userId,
        workspaceId: context.workspaceId,
        expires: Date.now() + 8 * 3600000,
      }),
    ).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }
  verify(cookie: string | undefined, context: AccessContext) {
    const value = cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("hutian_session="))
      ?.slice("hutian_session=".length);
    if (!value || value.length > 1500)
      throw new UnauthorizedException("需要重新建立工作台会话。");
    const [payload, signature] = value.split(".");
    if (!payload || !signature)
      throw new UnauthorizedException("工作台会话无效。");
    const actual = Buffer.from(signature),
      expected = Buffer.from(this.sign(payload));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new UnauthorizedException("工作台会话无效。");
    try {
      const row = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (
        row.userId !== context.userId ||
        row.workspaceId !== context.workspaceId ||
        !Number.isFinite(row.expires) ||
        row.expires <= Date.now()
      )
        throw new Error();
    } catch {
      throw new UnauthorizedException("工作台会话已失效。");
    }
  }
}
