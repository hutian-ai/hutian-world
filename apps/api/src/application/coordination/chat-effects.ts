import { DBOS } from "@dbos-inc/dbos-sdk";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource, LessThanOrEqual } from "typeorm";
import {
  ApplicationError,
  publicError,
} from "../../common/errors/application-error.js";
import { ChatEffectSchema } from "../../modules/chat-requests/entities/chat-effect.schema.js";
import { ChatRequestSchema } from "../../modules/chat-requests/entities/chat-request.schema.js";
import { ApplicationServices } from "../application-services.js";
import { reflectChat } from "../conversations/chat-context-tools.js";

let processEffect: (id: string) => Promise<number>;
const observe = DBOS.registerStep((id: string) => processEffect(id), {
  name: "chat-memory-effect-v1",
  retriesAllowed: true,
  maxAttempts: 3,
});
const effectWorkflow = DBOS.registerWorkflow(
  async (id: string) => {
    for (;;) {
      const wait = await observe(id);
      if (!wait) return;
      await DBOS.sleep(wait);
    }
  },
  { name: "chat-memory-effect-v1" },
);

@Injectable()
export class ChatEffects {
  private timer?: ReturnType<typeof setInterval>;
  private collecting = false;
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(ApplicationServices) private readonly app: ApplicationServices,
  ) {
    processEffect = (id) => this.process(id);
  }
  async start() {
    this.timer = setInterval(() => void this.collect(), 10000);
    this.timer.unref();
    await this.collect();
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  async collect() {
    if (this.collecting) return;
    this.collecting = true;
    try {
      const rows = await this.db.getRepository(ChatEffectSchema).find({
        where: {
          state: "pending",
          nextAttemptAt: LessThanOrEqual(new Date()),
        },
        take: 20,
        order: { createdAt: "ASC" },
      });
      for (const row of rows)
        await DBOS.startWorkflow(effectWorkflow, {
          workflowID: `chat-effect:${row.workspaceId}:${row.requestId}:${row.generation}`,
        })(row.requestId);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "chat_effect_dispatch_unconfirmed",
          code: publicError(error).code,
        }),
      );
    } finally {
      this.collecting = false;
    }
  }
  async inspect(id: string) {
    const workspaceId = this.app.contexts.current().workspaceId;
    const row = await this.db
      .getRepository(ChatEffectSchema)
      .findOneBy({ requestId: id, workspaceId });
    if (!row)
      throw new ApplicationError("提取记录不存在或不可访问。", 40400, 404);
    return row;
  }
  async retry(id: string) {
    const row = await this.inspect(id);
    if (row.state !== "attention")
      throw new ApplicationError(
        "此提取记录无需人工重试。",
        40900,
        409,
        "refresh",
      );
    const changed = await this.db.getRepository(ChatEffectSchema).update(
      {
        requestId: id,
        workspaceId: row.workspaceId,
        state: "attention",
        generation: row.generation,
      },
      {
        state: "pending",
        attempts: 0,
        generation: row.generation + 1,
        nextAttemptAt: new Date(),
        updatedAt: new Date(),
      },
    );
    if (!changed.affected)
      throw new ApplicationError(
        "提取记录已变化，请刷新核对。",
        40900,
        409,
        "refresh",
      );
    await this.collect();
    return this.inspect(id);
  }
  private async process(id: string): Promise<number> {
    const repository = this.db.getRepository(ChatEffectSchema);
    const effect = await repository.findOneBy({ requestId: id });
    if (!effect || effect.state !== "pending") return 0;
    if (effect.nextAttemptAt.getTime() > Date.now())
      return effect.nextAttemptAt.getTime() - Date.now();
    try {
      const row = await this.db
        .getRepository(ChatRequestSchema)
        .findOneByOrFail({ id, workspace_id: effect.workspaceId });
      await this.app.contexts.run(await this.app.contexts.local(), async () => {
        await this.app.contexts.authorizeRun({
          workspaceId: row.workspace_id,
          requestedByUserId: row.requested_by_user_id,
          runAsUserId: row.requested_by_user_id,
          communicationConnectionId: row.communication_connection_id,
          runtimeConnectionId: row.runtime_connection_id,
        });
        if (
          row.state !== "replied" ||
          row.reply_event_id !== effect.replyEventId
        )
          throw new Error("Delivery identity mismatch");
        const token = row.snapshot.context.toolBridgeToken;
        if (typeof token === "string") {
          const result = await reflectChat(
            this.app,
            token,
            effect.replyEventId,
          );
          if (
            result &&
            "status" in result &&
            !["completed", "skipped"].includes(String(result.status))
          )
            throw new ApplicationError(
              "原记忆提取尚未确认。",
              50300,
              503,
              "observe",
            );
        }
      });
      await repository.update(
        { requestId: id, state: "pending" },
        { state: "completed", errorCode: null, updatedAt: new Date() },
      );
      return 0;
    } catch (error) {
      const failure = publicError(error),
        attempts = effect.attempts + 1;
      const wait = Math.min(3600000, 15000 * 2 ** Math.min(attempts, 8));
      const attention =
        attempts >= 12 || [400, 401, 403, 404, 422].includes(failure.status);
      await repository.update(
        { requestId: id, state: "pending" },
        {
          attempts,
          state: attention ? "attention" : "pending",
          errorCode: failure.code,
          nextAttemptAt: new Date(Date.now() + wait),
          updatedAt: new Date(),
        },
      );
      console.error(
        JSON.stringify({
          event: "chat_effect_unconfirmed",
          requestId: id,
          code: failure.code,
          attempts,
          attention,
        }),
      );
      return attention ? 0 : wait;
    }
  }
}
