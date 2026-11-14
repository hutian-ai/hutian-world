import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getWorkspace } from "./api";
import { readConversation, readDirectory } from "./communications";

export const resourceScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace") }).strict(),
  z.object({ kind: z.literal("role"), id: z.uuid() }).strict(),
  z.object({ kind: z.literal("conversation"), id: z.string().startsWith("!").max(500) }).strict(),
]);
export type ResourceScope = z.infer<typeof resourceScope>;

export function scopeUrl(kind: "memory" | "knowledge", scope?: ResourceScope, source?: string) {
  const query = new URLSearchParams();
  if (scope?.kind === "role") query.set("role", scope.id);
  if (scope?.kind === "conversation") query.set("room", scope.id);
  if (source) query.set("source", source);
  return `/${kind}${query.size ? `?${query}` : ""}`;
}
export async function resolveResourceScope(input?: ResourceScope) {
  const scope = resourceScope.parse(input ?? { kind: "workspace" });
  const workspace = await getWorkspace();
  let label = "个人工作台", description = "仅供当前创造者管理，不自动提供给角色或群聊。";
  if (scope.kind === "role") {
    const role = workspace.roles.find(r => r.id === scope.id);
    if (!role) throw new Error("成员不存在或不可访问。");
    label = `${role.name} · 私有`;
    description = "仅在与这位角色的私聊中使用，不自动带入群聊或频道。";
  } else if (scope.kind === "conversation") {
    const state = await readConversation(scope.id);
    label = `${state.room.name} · 会话共享`;
    description = "供本会话中被明确调用的成员使用。保存前请确认内容可向会话成员共享。";
  }
  const key = "hw-" + createHash("sha256").update(JSON.stringify([workspace.access.resourceNamespace, scope])).digest("hex").slice(0, 40);
  return { ...scope, key, label, description };
}
export async function resourceScopeOptions() {
  const [workspace, directory] = await Promise.all([getWorkspace(), readDirectory().catch(() => null)]);
  const options = [
    { scope: { kind: "workspace" } as ResourceScope, label: "个人工作台" },
    ...workspace.roles.map(r => ({ scope: { kind: "role", id: r.id } as ResourceScope, label: `${r.name} · 私有` })),
    ...(directory?.rooms ?? []).map(r => ({ scope: { kind: "conversation", id: r.id } as ResourceScope, label: `${r.name} · 会话共享` })),
  ];
  return { options, conversationsUnavailable: directory === null };
}
/** A role's identity alone never makes its private resources visible in a shared room. */
export async function conversationResourceScopes(roomId: string, roleId?: string) {
  const state = await readConversation(roomId);
  const scopes: ResourceScope[] = [{ kind: "conversation", id: roomId }];
  if (!roleId) return scopes;
  const role = (await getWorkspace()).roles.find(r => r.id === roleId);
  if (!role?.chatIdentity || !state.agents.some(a => a.joined && a.userId === role.chatIdentity!.userId))
    throw new Error("成员尚未加入当前会话。");
  const room = (await readDirectory()).rooms.find(r => r.id === roomId);
  // The kind comes from the immutable Matrix creation event, and current members are checked independently.
  const verifiedDirect = room?.kind === "direct" && state.members.length === 2 &&
    state.members.some(m => m.id === role.chatIdentity!.userId);
  if (verifiedDirect) scopes.unshift({ kind: "role", id: role.id });
  return scopes;
}
