import type { ScheduledNoticeChange } from "@hutian-world/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { DataSource, IsNull, Not } from "typeorm";
import { readDatabaseCursor, writeCursor } from "../../common/pagination.js";
import { AccessContexts } from "../access/access-context.service.js";
import { ScheduleNoticeSchema } from "./entities/schedule-notice.schema.js";

/** Scoped persistence adapter. SQL is reserved for atomic projection and compare-and-swap receipts. */
@Injectable()
export class ScheduleNoticesRepository {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  private get owner() {
    const c = this.contexts.current();
    return { workspace_id: c.workspaceId, user_id: c.userId };
  }
  private get records() {
    return this.db.getRepository(ScheduleNoticeSchema);
  }
  async counts() {
    const [unread, attention] = await Promise.all([
      this.records.countBy({ ...this.owner, read_at: IsNull() }),
      this.records.countBy({
        ...this.owner,
        kind: Not("result"),
        resolved_at: IsNull(),
      }),
    ]);
    return { unread, attention };
  }
  async list(filter: "all" | "unread" | "attention", cursor?: string) {
    const after = readDatabaseCursor(cursor);
    const query = this.records.createQueryBuilder("notice").where({
      ...this.owner,
      ...(filter === "unread"
        ? { read_at: IsNull() }
        : filter === "attention"
          ? { kind: Not("result"), resolved_at: IsNull() }
          : {}),
    });
    if (after)
      query.andWhere(
        "(date_trunc('milliseconds',notice.updated_at),notice.id) < (:at::timestamptz,:id::uuid)",
        after,
      );
    const rows = await query
      .orderBy("date_trunc('milliseconds',notice.updated_at)", "DESC")
      .addOrderBy("notice.id", "DESC")
      .take(51)
      .getMany();
    const records = rows.slice(0, 50),
      last = records.at(-1);
    return {
      records,
      nextCursor:
        rows.length > 50 && last
          ? writeCursor(last.updated_at.toISOString(), last.id)
          : null,
    };
  }
  get(id: string) {
    return this.records.findOneBy({ ...this.owner, id });
  }
  async syncNotices() {
    const c = this.contexts.current();
    await this.db.query(
      `INSERT INTO scheduled_run_notices
      (id,workspace_id,user_id,kind,state_key,updated_at)
      SELECT r.id,r.workspace_id,r.requested_by_user_id,
        CASE WHEN r.state='replied' THEN 'result'
          WHEN r.state IN ('failed','missed') THEN 'failed' ELSE 'attention' END,
        r.state,r.updated_at
      FROM scheduled_runs r JOIN scheduled_tasks t ON t.id=r.schedule_id
      WHERE t.workspace_id=$1 AND t.created_by_user_id=$2 AND t.creator_id=$3
        AND r.state IN ('replied','failed','missed','waiting_permission','blocked','unknown')
      ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,state_key=EXCLUDED.state_key,
        updated_at=EXCLUDED.updated_at,read_at=NULL,resolved_at=NULL
      WHERE scheduled_run_notices.state_key<>EXCLUDED.state_key`,
      [c.workspaceId, c.userId, c.creatorId],
    );
    await this.db.query(
      `UPDATE scheduled_run_notices n SET resolved_at=COALESCE(n.resolved_at,now()),state_key=r.state
      FROM scheduled_runs r WHERE n.id=r.id AND n.workspace_id=$1 AND n.user_id=$2
        AND r.state NOT IN ('replied','failed','missed','waiting_permission','blocked','unknown')
        AND n.state_key<>r.state`,
      [c.workspaceId, c.userId],
    );
  }
  async markNotice(
    id: string,
    action: "read" | "unread" | "done",
    updatedAt: string,
  ) {
    const c = this.contexts.current();
    const field = action === "done" ? "resolved_at" : "read_at";
    const [changed] = await this.db.query(
      `WITH previous AS (
        SELECT * FROM scheduled_run_notices
        WHERE id=$1 AND workspace_id=$2 AND user_id=$3
          AND date_trunc('milliseconds',updated_at)=$4::timestamptz
        FOR UPDATE
      ), changed AS (
        UPDATE scheduled_run_notices n
        SET ${field}=${action === "unread" ? "NULL" : "date_trunc('milliseconds',clock_timestamp())"}
        FROM previous p WHERE n.id=p.id
          ${action === "done" ? "AND EXISTS (SELECT 1 FROM scheduled_runs r WHERE r.id=n.id AND r.state IN ('failed','missed'))" : ""}
        RETURNING p.${field} AS before, n.${field} AS after, n.xmin::text AS revision
      ) SELECT * FROM changed`,
      [id, c.workspaceId, c.userId, updatedAt],
    );
    if (!changed)
      throw new ConflictException("通知状态已变化，请刷新后再操作。");
    return {
      ok: true,
      change: {
        id,
        revision: changed.revision,
        updatedAt,
        field: action === "done" ? "resolvedAt" : "readAt",
        before: changed.before?.toISOString() ?? null,
        after: changed.after?.toISOString() ?? null,
      } satisfies ScheduledNoticeChange,
    };
  }
  async undoNotice(change: ScheduledNoticeChange) {
    const c = this.contexts.current();
    const field = change.field === "readAt" ? "read_at" : "resolved_at";
    const changed = await this.db.query(
      `UPDATE scheduled_run_notices n SET ${field}=$5::timestamptz
       WHERE id=$1 AND workspace_id=$2 AND user_id=$3
         AND date_trunc('milliseconds',updated_at)=$4::timestamptz
         AND date_trunc('milliseconds',${field}) IS NOT DISTINCT FROM $6::timestamptz
         AND xmin::text=$7
         ${change.field === "resolvedAt" ? "AND EXISTS (SELECT 1 FROM scheduled_runs r WHERE r.id=n.id AND r.state IN ('failed','missed'))" : ""}
       RETURNING id`,
      [
        change.id,
        c.workspaceId,
        c.userId,
        change.updatedAt,
        change.before,
        change.after,
        change.revision,
      ],
    );
    if (!changed[1])
      throw new ConflictException(
        "通知已有后续变化，未覆盖当前状态。请刷新核对。",
      );
    return { ok: true };
  }
}
