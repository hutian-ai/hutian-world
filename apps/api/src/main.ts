import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { randomUUID } from "node:crypto";
import "reflect-metadata";
import { AppModule } from "./app.module.js";
import type { Environment } from "./config/environment.js";
let app: NestFastifyApplication | undefined;
try {
  app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 12 * 1024 * 1024,
      genReqId: () => randomUUID(),
    }),
    { logger: ["error", "warn"], abortOnError: false },
  );
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      /^multipart\/form-data/,
      { parseAs: "buffer" },
      (
        _req: unknown,
        body: Buffer,
        done: (error: Error | null, value?: Buffer) => void,
      ) => done(null, body),
    );
  app.enableShutdownHooks();
  const env = app.get<Environment>("ENV");
  await app.listen(env.HUTIAN_API_PORT, "127.0.0.1");
  Logger.log(`API 已启动：http://127.0.0.1:${env.HUTIAN_API_PORT}`, "hutian");
  console.log(`hutian API 已启动：http://127.0.0.1:${env.HUTIAN_API_PORT}`);
} catch (error) {
  if (app) await app.close();
  console.error(
    error instanceof Error && error.message.startsWith("数据库结构")
      ? error.message
      : "hutian API 启动失败，请核对 .local/app.env、数据库和端口；未输出连接凭据。",
  );
  process.exitCode = 1;
}
