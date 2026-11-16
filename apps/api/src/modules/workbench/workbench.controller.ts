import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { commands } from "./commands.js";
import { WorkbenchApplication } from "./application.service.js";

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
@Controller("v1/commands")
export class WorkbenchController {
  constructor(
    @Inject(WorkbenchApplication)
    private readonly application: WorkbenchApplication,
  ) {}
  @Post(":command") async execute(
    @Param("command") command: string,
    @Body() body: unknown,
  ) {
    const work = Object.hasOwn(commands, command)
      ? commands[command as keyof typeof commands]
      : undefined;
    if (!work) throw new Error("应用操作不存在。");
    const args = z.array(z.unknown()).max(8).parse(body).map(decode);
    return (work as (...args: unknown[]) => Promise<unknown>)(...args);
  }
}
