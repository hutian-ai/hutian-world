"use client";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ResourceScope } from "@/lib/resource-scopes";
export function ResourceScopePicker({ kind, scope, options }: {
  kind: "knowledge" | "memory";
  scope: ResourceScope;
  options: { scope: ResourceScope; label: string }[];
}) {
  const router = useRouter();
  const key = (scope: ResourceScope) => scope.kind === "workspace" ? "workspace" : `${scope.kind}:${scope.id}`;
  return <Select value={key(scope)} onValueChange={value => {
    const selected = options.find(option => key(option.scope) === value)?.scope;
    if (!selected) return;
    const query = new URLSearchParams();
    if (selected.kind !== "workspace") query.set(selected.kind === "role" ? "role" : "room", selected.id);
    router.push(`/${kind}${query.size ? `?${query}` : ""}`);
  }}>
    <SelectTrigger aria-label="资源范围" className="w-full sm:w-72"><SelectValue /></SelectTrigger>
    <SelectContent>{options.map(option => <SelectItem key={key(option.scope)} value={key(option.scope)}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}
