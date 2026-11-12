import "reflect-metadata";
import { Module, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { APP_GUARD } from "@nestjs/core";
import { DataSource } from "typeorm";
import { environment } from "./environment.js";
import { dataSource } from "./database/source.js";
import { CreatorSchema } from "./database/schema.js";
import { WorkspaceService } from "./workspace.service.js";
import { LocalApiGuard, PublicErrorFilter, WorkspaceController } from "./http.js";

let connection: DataSource | undefined;
try {
  const env = await environment();
  const db = dataSource(env.HUTIAN_DATABASE_URL);
  connection = db;
  await db.initialize();
  if (await db.showMigrations()) { await db.destroy(); throw new Error("数据库结构尚未准备，请先运行 pnpm db:migrate。"); }
  await db.getRepository(CreatorSchema).createQueryBuilder().insert().values({ id: env.HUTIAN_CREATOR_ID, displayName: "我的工作台" }).orIgnore().execute();
  @Module({
    controllers: [WorkspaceController],
    providers: [{ provide: "DB_LIFECYCLE", useValue: { async onApplicationShutdown() { if (db.isInitialized) await db.destroy(); } } }, WorkspaceService, { provide: DataSource, useValue: db }, { provide: "ENV", useValue: env }, { provide: APP_GUARD, useClass: LocalApiGuard }],
  })
  class AppModule {}
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 65536 }), { logger: ["error", "warn"] });
  app.useGlobalFilters(new PublicErrorFilter());
  app.enableShutdownHooks();
  // A health check returns no user data. All business endpoints use the guard.
  app.getHttpAdapter().get("/health", async (_req: unknown, reply: { status: (code: number) => { send: (body: object) => void } }) => {
    try { await db.query("SELECT 1"); return { status: "ok" }; }
    catch { reply.status(503).send({ status: "unavailable" }); }
  });
  await app.listen(env.HUTIAN_API_PORT, "127.0.0.1");
  Logger.log(`API 已启动：http://127.0.0.1:${env.HUTIAN_API_PORT}`, "hutian");
  console.log(`hutian API 已启动：http://127.0.0.1:${env.HUTIAN_API_PORT}`);
} catch (error) {
  if (connection?.isInitialized) await connection.destroy();
  console.error(error instanceof Error && error.message.startsWith("数据库结构") ? error.message : "hutian API 启动失败，请核对 .local/app.env、数据库和端口；未输出连接凭据。");
  process.exitCode = 1;
}
