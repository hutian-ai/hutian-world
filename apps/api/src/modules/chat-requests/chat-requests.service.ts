import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { isDeepStrictEqual } from "node:util";
import { DataSource } from "typeorm";
import {
  ensureChatWorkflow,
  registerChatProcessor,
} from "./chat-request.workflow.js";
import { ChatHostClient } from "../../infrastructure/chat-host/chat-host.client.js";
import type {
  ChatRequestInput,
  ChatRequestRecord,
} from "@hutian-world/contracts";
import { AccessContexts } from "../access/access-context.service.js";

import {
  ChatRequestSchema,
  type ChatRequestRow as Row,
} from "./entities/chat-request.schema.js";
const view = (r: Row): ChatRequestRecord => ({
  id: r.id,
  workspaceId: r.workspace_id,
  requestedByUserId: r.requested_by_user_id,
  communicationConnectionId: r.communication_connection_id,
  runtimeConnectionId: r.runtime_connection_id,
  snapshot: r.snapshot,
  state: r.state,
  runId: r.run_id,
  replyEventId: r.reply_event_id,
  error: r.error,
});

@Injectable()
export class ChatRequestsService {
  private timer?: ReturnType<typeof setInterval>;
  private launching = false;
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly access: AccessContexts,
    @Inject(ChatHostClient) private readonly host: ChatHostClient,
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
  async create(input: ChatRequestInput) {
    const current = this.access.current();
    await this.db
      .createQueryBuilder()
      .insert()
      .into(ChatRequestSchema)
      .values({
        id: input.id,
        workspace_id: current.workspaceId,
        requested_by_user_id: current.userId,
        communication_connection_id: current.connections.matrix,
        runtime_connection_id: current.connections.dock,
        snapshot: () => ":snapshot::jsonb",
      })
      .setParameter("snapshot", JSON.stringify(input))
      .orIgnore()
      .execute();
    const result = await this.get(input.id);
    if (!isDeepStrictEqual(result.snapshot, input))
      throw new ConflictException(
        "同一请求编号已用于不同内容；原请求未被替换。",
      );
    void this.ensureWorkflows();
    return result;
  }
  async get(id: string) {
    const c = this.access.current();
    const row = await this.db.getRepository(ChatRequestSchema).findOneBy({
      id,
      workspace_id: c.workspaceId,
      requested_by_user_id: c.userId,
    });
    if (!row) throw new NotFoundException("原聊天请求不存在或不可访问。");
    return view(row);
  }
  async list(roomId: string) {
    const c = this.access.current();
    const rows = await this.db
      .getRepository(ChatRequestSchema)
      .createQueryBuilder("request")
      .where({ workspace_id: c.workspaceId, requested_by_user_id: c.userId })
      .andWhere("request.snapshot->>'roomId' = :roomId", { roomId })
      .orderBy("request.created_at", "DESC")
      .take(100)
      .getMany();
    return rows.map(view);
  }
  private async process(id: string) {
    const row = await this.db
      .getRepository(ChatRequestSchema)
      .findOneBy({ id });
    if (
      !row ||
      ["replied", "failed", "cancelled", "blocked", "skipped"].includes(
        row.state,
      )
    )
      return true;
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
      await this.db
        .createQueryBuilder()
        .update(ChatRequestSchema)
        .set({
          state: update.state,
          run_id: () => 'COALESCE(:runId::uuid, "run_id")',
          reply_event_id: () =>
            'COALESCE(:replyEventId::text, "reply_event_id")',
          error: update.error,
          updated_at: () => "now()",
        })
        .where({ id })
        .andWhere(
          "(run_id IS NULL OR :runId::uuid IS NULL OR run_id=:runId::uuid)",
        )
        .setParameters({
          runId: update.runId,
          replyEventId: update.replyEventId,
        })
        .execute();
      return ["replied", "failed", "cancelled", "blocked", "skipped"].includes(
        update.state,
      );
    } catch {
      await this.db.getRepository(ChatRequestSchema).update(
        { id },
        {
          error: "协调响应未确认，继续核对原消息与运行",
          updated_at: () => "now()",
        },
      );
      return false;
    }
  }
}
