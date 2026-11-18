import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { publicError } from "../../common/errors/application-error.js";
import {
  chatTerminalStates,
  observationBackoff,
} from "../../common/execution-policy.js";
import { AccessContexts } from "../../modules/access/access-context.service.js";
import {
  ensureChatWorkflow,
  registerChatProcessor,
} from "../../modules/chat-requests/chat-request.workflow.js";
import { ChatEffectSchema } from "../../modules/chat-requests/entities/chat-effect.schema.js";
import { ExecutionApplication } from "../execution.application.js";

import { ChatRequestSchema } from "../../modules/chat-requests/entities/chat-request.schema.js";
@Injectable()
export class ChatCoordinator {
  private timer?: ReturnType<typeof setInterval>;
  private launching = false;
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly access: AccessContexts,
    @Inject(ExecutionApplication) private readonly host: ExecutionApplication,
  ) {
    registerChatProcessor((id) => this.process(id));
  }
  async start() {
    this.timer = setInterval(() => void this.ensureWorkflows(), 10000);
    this.timer.unref();
    await this.ensureWorkflows();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async ensureWorkflows() {
    if (this.launching) return;
    this.launching = true;
    try {
      const rows = await this.db.getRepository(ChatRequestSchema).find({
        where: { workflow_started: false },
        order: { created_at: "ASC" },
        take: 20,
      });
      for (const row of rows) {
        await ensureChatWorkflow(row.workspace_id, row.id);
        await this.db
          .getRepository(ChatRequestSchema)
          .update({ id: row.id }, { workflow_started: true });
      }
    } catch {
      /* Persisted request intent remains available for the next recovery pass. */
    } finally {
      this.launching = false;
    }
  }
  private async process(id: string) {
    const row = await this.db
      .getRepository(ChatRequestSchema)
      .findOneBy({ id });
    if (!row || chatTerminalStates.includes(row.state)) return true;
    if (row.next_observe_at && row.next_observe_at.getTime() > Date.now())
      return false;
    try {
      const local = await this.access.local();
      await this.access.run(local, () =>
        this.access.authorizeRun({
          workspaceId: row.workspace_id,
          requestedByUserId: row.requested_by_user_id,
          runAsUserId: row.requested_by_user_id,
          communicationConnectionId: row.communication_connection_id,
          runtimeConnectionId: row.runtime_connection_id,
        }),
      );
    } catch {
      await this.db.getRepository(ChatRequestSchema).update(
        { id },
        {
          state: "blocked",
          error: "执行身份或连接已不可用",
          updated_at: () => "now()",
        },
      );
      return true;
    }
    try {
      const update = await this.access.run(await this.access.local(), () =>
        this.host.dispatchChat({
          id,
          workspaceId: row.workspace_id,
          userId: row.requested_by_user_id,
        }),
      );
      if (
        ![
          "queued",
          "preparing",
          "running",
          "waiting_permission",
          "unknown",
          "replied",
          "failed",
          "cancelled",
          "blocked",
          "skipped",
        ].includes(update.state)
      )
        throw new Error();
      // Keep the conditional update atomic: an observation cannot replace the native run identity.
      const applied = await this.db.transaction(async (manager) => {
        const changed = await manager
          .createQueryBuilder()
          .update(ChatRequestSchema)
          .set({
            state: update.state,
            observe_attempts: 0,
            next_observe_at: null,
            run_id: () => 'COALESCE(:runId::uuid, "run_id")',
            reply_event_id: () =>
              'COALESCE(:replyEventId::text, "reply_event_id")',
            error: update.error,
            updated_at: () => "now()",
          })
          .where({ id })
          .andWhere("state NOT IN (:...terminal)", {
            terminal: ["replied", "failed", "cancelled", "skipped"],
          })
          .andWhere(
            "(run_id IS NULL OR :runId::uuid IS NULL OR run_id=:runId::uuid)",
          )
          .setParameters({
            runId: update.runId,
            replyEventId: update.replyEventId,
          })
          .execute();
        if (
          changed.affected &&
          update.state === "replied" &&
          update.replyEventId &&
          typeof row.snapshot.context.toolBridgeToken === "string"
        )
          await manager
            .createQueryBuilder()
            .insert()
            .into(ChatEffectSchema)
            .values({
              requestId: row.id,
              workspaceId: row.workspace_id,
              replyEventId: update.replyEventId,
            })
            .orIgnore()
            .execute();
        return Boolean(changed.affected);
      });
      return applied && chatTerminalStates.includes(update.state);
    } catch (error) {
      const attempts = row.observe_attempts + 1;
      console.error(
        JSON.stringify({
          event: "chat_observation_unconfirmed",
          requestId: id,
          runId: row.run_id,
          attempts,
          code: publicError(error).code,
        }),
      );
      await this.db.getRepository(ChatRequestSchema).update(
        { id },
        {
          error: "协调响应未确认，继续核对原消息与运行",
          observe_attempts: attempts,
          next_observe_at: observationBackoff(attempts),
          updated_at: () => "now()",
        },
      );
      return false;
    }
  }
}
