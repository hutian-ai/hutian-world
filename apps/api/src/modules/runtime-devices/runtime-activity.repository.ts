import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type { RuntimeOverviewInput } from "@hutian-world/contracts";
import { AccessContexts } from "../access/access-context.service.js";
import { readDatabaseCursor, writeCursor } from "../../common/pagination.js";

type WorkRow = {
  id: string;
  source: "chat" | "schedule";
  title: string | null;
  node_id: string;
  provider: string;
  role_id: string | null;
  agent_id: string | null;
  room_id: string | null;
  event_id: string | null;
  state: string;
  model: string | null;
  config: unknown;
  run_id: string | null;
  created_at: Date;
  updated_at: Date;
  cursor_at: string;
};
type Summary = {
  node_id: string;
  provider: string;
  state: string;
  count: string;
  last_at: Date;
};
// This is a read projection of existing Hutian requests, not a second execution ledger.
// PostgreSQL JSON queries stay here; authority uses the original request scope.
@Injectable()
export class RuntimeActivityRepository {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  async read(input: RuntimeOverviewInput) {
    const c = this.contexts.current();
    const args = [
      c.workspaceId,
      c.userId,
      c.connections.dock,
      input.nodeId ?? null,
      input.provider ?? null,
    ];
    const cte = `WITH work AS (
      SELECT id, 'chat' AS source, NULL::text AS title,
        snapshot->'context'->>'nodeId' AS node_id, snapshot->'context'->>'provider' AS provider,
        NULL::text AS role_id, snapshot->>'agentId' AS agent_id,
        snapshot->>'roomId' AS room_id, snapshot->>'eventId' AS event_id,
        state, snapshot->'context'->>'model' AS model, snapshot->'context'->'config' AS config,
        run_id, created_at, updated_at
      FROM chat_requests WHERE workspace_id=$1 AND requested_by_user_id=$2 AND runtime_connection_id=$3
      UNION ALL
      SELECT r.id, 'schedule', r.snapshot->>'title',
        r.snapshot->'runtime'->>'nodeId', r.snapshot->'runtime'->>'provider',
        r.snapshot->>'roleId', NULL::text, r.snapshot->>'roomId', r.event_id,
        r.state, r.snapshot->'runtime'->'preferences'->>'model', r.snapshot->'runtime'->'preferences',
        r.run_id, r.created_at, r.updated_at
      FROM scheduled_runs r JOIN scheduled_tasks t ON t.id=r.schedule_id AND t.workspace_id=r.workspace_id
      WHERE r.workspace_id=$1 AND r.requested_by_user_id=$2 AND r.runtime_connection_id=$3 AND t.created_by_user_id=$2
    ), scoped AS (SELECT * FROM work WHERE node_id IS NOT NULL AND provider IS NOT NULL
      AND ($4::text IS NULL OR node_id=$4) AND ($5::text IS NULL OR provider=$5)) `;
    const summaries = await this.db.query<Summary[]>(
      cte +
        `SELECT node_id,provider,state,count(*)::text AS count,max(updated_at) AS last_at FROM scoped GROUP BY node_id,provider,state`,
      args,
    );
    if (!input.nodeId)
      return {
        summaries,
        active: [] as WorkRow[],
        activeHasMore: false,
        recent: [] as WorkRow[],
        nextCursor: null,
      };
    const cursor = readDatabaseCursor(input.cursor);
    const columns = `*,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at`;
    const [active, recent] = await Promise.all([
      this.db.query<WorkRow[]>(
        cte +
          `SELECT ${columns} FROM scoped WHERE state NOT IN ('replied','completed','failed','cancelled','missed','skipped') ORDER BY created_at DESC,id DESC LIMIT 51`,
        args,
      ),
      this.db.query<WorkRow[]>(
        cte +
          `SELECT ${columns} FROM scoped WHERE ($6::timestamptz IS NULL OR (created_at,id)<($6::timestamptz,$7::uuid)) ORDER BY created_at DESC,id DESC LIMIT 21`,
        [...args, cursor?.at ?? null, cursor?.id ?? null],
      ),
    ]);
    const last = recent[19];
    return {
      summaries,
      active: active.slice(0, 50),
      activeHasMore: active.length > 50,
      recent: recent.slice(0, 20),
      nextCursor:
        recent.length > 20 && last
          ? writeCursor(last.cursor_at, last.id)
          : null,
    };
  }
}
