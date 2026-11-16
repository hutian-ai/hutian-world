import { Controller, Get, Inject, SetMetadata, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { DataSource } from "typeorm";
export const PUBLIC_HEALTH = "hutian:public-health";
@Controller("health")
export class HealthController {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}
  @Get()
  @SetMetadata(PUBLIC_HEALTH, true)
  async health(@Res({ passthrough: true }) reply: FastifyReply) {
    try {
      await this.db.query("SELECT 1");
      return { status: "ok" };
    } catch {
      reply.status(503);
      return { status: "unavailable" };
    }
  }
}
