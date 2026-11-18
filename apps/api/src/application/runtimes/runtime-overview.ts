import {
  runtimeOverviewInput,
  runtimeOverviewSchema,
  executionPreferences,
  type RuntimeOverview,
} from "@hutian-world/contracts";
import type { ApplicationServices } from "../application-services.js";
export async function readRuntimeOverview(
  app: Pick<ApplicationServices, "contexts" | "runtimeActivity" | "roles">,
  input: unknown,
) {
  const query = runtimeOverviewInput.parse(input);
  const [rows, roles] = await Promise.all([
    app.runtimeActivity.read(query),
    app.roles.list(),
  ]);
  const summaries = new Map<string, RuntimeOverview["summaries"][number]>();
  for (const row of rows.summaries) {
    const key = `${row.node_id}/${row.provider}`;
    const item = summaries.get(key) ?? {
      nodeId: row.node_id,
      provider: row.provider,
      running: 0,
      queued: 0,
      attention: 0,
      total: 0,
      lastActivityAt: null,
    };
    const count = Number(row.count);
    item.total += count;
    if (row.state === "running") item.running += count;
    else if (["accepted", "queued", "preparing"].includes(row.state))
      item.queued += count;
    else if (["waiting_permission", "blocked", "unknown"].includes(row.state))
      item.attention += count;
    const at = row.last_at.toISOString();
    if (!item.lastActivityAt || at > item.lastActivityAt)
      item.lastActivityAt = at;
    summaries.set(key, item);
  }
  const project = (row: (typeof rows.recent)[number]) => {
    const role = roles.find((r) =>
      row.role_id
        ? r.id === row.role_id
        : r.chatIdentity?.agentId === row.agent_id,
    );
    const roomQuery = new URLSearchParams({
      room: row.room_id ?? "",
      ...(role ? { role: role.id } : {}),
      ...(row.event_id ? { at: row.event_id } : {}),
    });
    return {
      id: row.id,
      source: row.source,
      title: row.title || `${role?.name ?? "成员"}的聊天工作`,
      nodeId: row.node_id,
      provider: row.provider,
      roleId: role?.id ?? null,
      member: role?.name ?? "原成员",
      state: row.state,
      href:
        row.source === "schedule"
          ? `/inbox?run=${row.id}`
          : `/chat?${roomQuery}`,
      model: row.model,
      preferences: executionPreferences
        .strip()
        .catch({})
        .parse(row.config ?? {}),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      runId: row.run_id,
    };
  };
  return runtimeOverviewSchema.parse({
    checkedAt: new Date().toISOString(),
    summaries: [...summaries.values()],
    members: roles.flatMap((r) =>
      r.runtimeBinding &&
      (!query.nodeId || r.runtimeBinding.nodeId === query.nodeId) &&
      (!query.provider || r.runtimeBinding.provider === query.provider)
        ? [
            {
              id: r.id,
              name: r.name,
              nodeId: r.runtimeBinding.nodeId,
              provider: r.runtimeBinding.provider,
              preferences: r.runtimeBinding.preferences ?? {},
            },
          ]
        : [],
    ),
    active: rows.active.map(project),
    activeHasMore: rows.activeHasMore,
    recent: rows.recent.map(project),
    nextCursor: rows.nextCursor,
  });
}
