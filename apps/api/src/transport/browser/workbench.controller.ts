import {
  HttpCode,
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { ApplicationError } from "../../common/errors/application-error.js";
import { WorkbenchApplication } from "./application.service.js";
import { legacyOperations } from "./legacy-operations.js";

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (row.type === "form-data") {
      const data = new FormData();
      const entries = z
        .array(
          z.tuple([
            z.string().max(200),
            z.union([
              z.string().max(100000),
              z
                .object({
                  name: z.string().max(300),
                  mime: z.string().max(200),
                  base64: z.string().max(24000),
                })
                .strict(),
            ]),
          ]),
        )
        .max(30)
        .parse(row.entries);
      for (const [key, entry] of entries)
        data.append(
          key,
          typeof entry === "string"
            ? entry
            : new File([Buffer.from(entry.base64, "base64")], entry.name, {
                type: entry.mime,
              }),
        );
      return data;
    }
    return Object.fromEntries(
      Object.entries(row).map(([key, entry]) => [key, decode(entry)]),
    );
  }
  return value;
}
@Controller(["v1/commands", "v2/commands"])
export class WorkbenchController {
  constructor(
    @Inject(WorkbenchApplication)
    private readonly application: WorkbenchApplication,
  ) {}
  @HttpCode(200)
  @Post(":command")
  async execute(
    @Param("command") command: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    if (request.url.startsWith("/v1/"))
      command = legacyOperations[command] ?? command;
    const commands = this.application.commands;
    const work = Object.hasOwn(commands, command)
      ? commands[command as keyof typeof commands]
      : undefined;
    if (!work) throw new ApplicationError("应用操作不存在。", 40400, 404);
    const args = z.array(z.unknown()).max(8).parse(body).map(decode);
    const result = await (work as (...args: unknown[]) => Promise<unknown>)(
      ...args,
    );
    if (
      request.url.startsWith("/v2/") &&
      result &&
      typeof result === "object" &&
      "error" in result &&
      typeof result.error === "string" &&
      (!("ok" in result) || result.ok === false)
    ) {
      const row = result as {
        error: string;
        code?: number;
        httpStatus?: number;
        recovery?: import("@hutian-world/contracts").Recovery;
      };
      throw new ApplicationError(
        row.error,
        row.code as import("@hutian-world/contracts").ErrorCode | undefined,
        row.httpStatus,
        row.recovery,
      );
    }
    return result;
  }
}
