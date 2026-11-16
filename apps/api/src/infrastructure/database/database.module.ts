import { Inject, Injectable, Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ConfigModule } from "../../config/config.module.js";
import type { Environment } from "../../config/environment.js";
import { dataSource } from "./data-source.js";
@Injectable()
class DatabaseLifecycle {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}
  async onApplicationShutdown() {
    if (this.db.isInitialized) await this.db.destroy();
  }
}
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DataSource,
      inject: ["ENV"],
      useFactory: async (env: Environment) => {
        const db = dataSource(env.HUTIAN_DATABASE_URL);
        try {
          await db.initialize();
          if (await db.showMigrations())
            throw new Error("数据库结构尚未准备，请先运行 pnpm db:migrate。");
          return db;
        } catch (error) {
          if (db.isInitialized) await db.destroy();
          throw error;
        }
      },
    },
    DatabaseLifecycle,
  ],
  exports: [DataSource],
})
export class DatabaseModule {}
