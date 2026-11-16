import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { HealthController } from "./health.controller.js";
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [],
  exports: [],
})
export class HealthModule {}
