import { Controller, Get, Inject, Res, SetMetadata } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { DataSource } from "typeorm";
import { WorkflowsService } from "../../infrastructure/workflows/workflows.module.js";
export const PUBLIC_HEALTH = "hutian:public-health";
@Controller("health")
export class HealthController {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(WorkflowsService) private readonly workflows: WorkflowsService,
  ) {}
  @Get("live")
  @SetMetadata(PUBLIC_HEALTH, true)
  live() {
    return { status: "ok" };
  }
  @Get(["", "ready"])
  @SetMetadata(PUBLIC_HEALTH, true)
  async health(@Res({ passthrough: true }) reply: FastifyReply) {
    try {
      await this.db.query("SELECT 1");
      if (!this.workflows.ready) {
        reply.status(503);
        return { status: "starting", database: "ready", workflows: "starting" };
      }
      return { status: "ok", database: "ready", workflows: "ready" };
    } catch {
      reply.status(503);
      return { status: "unavailable" };
    }
  }
}
