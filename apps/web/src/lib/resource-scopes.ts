import { z } from "zod";
import { command } from "./api";
export type * from "@hutian-world/contracts";
export const resolveResourceScope = command(
  "resource-scopes.resolveResourceScope",
);
export const resourceScopeOptions = command(
  "resource-scopes.resourceScopeOptions",
);
export const resourceScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workspace") }).strict(),
  z.object({ kind: z.literal("role"), id: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal("conversation"),
      id: z.string().startsWith("!").max(500),
    })
    .strict(),
]);
export type ResourceScope = z.infer<typeof resourceScope>;

export function scopeUrl(
  kind: "memory" | "knowledge",
  scope?: ResourceScope,
  source?: string,
) {
  const query = new URLSearchParams();
  if (scope?.kind === "role") query.set("role", scope.id);
  if (scope?.kind === "conversation") query.set("room", scope.id);
  if (source) query.set("source", source);
  return `/${kind}${query.size ? `?${query}` : ""}`;
}
