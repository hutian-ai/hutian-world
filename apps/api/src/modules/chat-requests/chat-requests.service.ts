import type {
  ChatRequestInput,
  ChatRequestRecord,
} from "@hutian-world/contracts";
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { isDeepStrictEqual } from "node:util";
import { DataSource } from "typeorm";
import { AccessContexts } from "../access/access-context.service.js";
import { ensureChatWorkflow } from "./chat-request.workflow.js";

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
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly access: AccessContexts,
  ) {}
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
    await ensureChatWorkflow(current.workspaceId, input.id).catch(
      () => undefined,
    );
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
}
