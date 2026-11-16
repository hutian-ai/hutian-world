"use client";

import Link from "@/lib/navigation";
import { useRef, useState } from "react";
import { ChevronDown, Monitor, RefreshCw } from "lucide-react";
import type {
  ExecutionPreferences,
  RoleRuntimeBinding,
} from "@hutian-world/contracts";
import type { Conversation } from "@/lib/communications";
import { effortLabel } from "@/lib/execution-settings";
import { saveRoleRuntime } from "@/lib/role-runtime-actions";
import {
  ExecutionPreferenceFields,
  useRuntimeCapabilities,
} from "./execution-preference-fields";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hutian-ai/design/ui/popover";

export function MemberExecutionSettings({
  agent,
  disabled,
  onPending,
  onSaved,
  onRefresh,
}: {
  agent: Conversation["agents"][number];
  disabled: boolean;
  onPending(value: boolean): void;
  onSaved(binding: RoleRuntimeBinding | null): void;
  onRefresh(): Promise<boolean | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const binding = agent.runtimeBinding;
  const inspection = useRuntimeCapabilities(binding ?? undefined, open);
  if (!agent.roleId) return null;
  const href = `/members/${agent.roleId}?view=settings&section=runtime`;
  const preferences = binding?.preferences ?? {};
  const model = preferences.model ?? inspection.capabilities?.current.model;
  const modelLabel =
    inspection.capabilities?.models.find((m) => m.id === model)?.name ??
    model ??
    "默认模型";
  const summary = [
    modelLabel,
    preferences.effort ? effortLabel(preferences.effort) : "默认推理",
  ].join(" · ");
  async function save(values: ExecutionPreferences) {
    if (!binding || !agent.roleId || locked.current) return;
    locked.current = true;
    setBusy(true);
    onPending(true);
    setError("");
    try {
      const result = await saveRoleRuntime(
        agent.roleId,
        {
          nodeId: binding.nodeId,
          provider: binding.provider,
          preferences: values,
        },
        binding.updatedAt,
      );
      if (!result.ok) {
        setUnknown(true);
        setError(result.error);
      } else {
        onSaved(result.binding);
        setUnknown(false);
        onPending(false);
      }
    } catch {
      setUnknown(true);
      setError("保存结果未确认，请重新读取成员配置后继续。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      {binding && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || busy}
              className="max-w-56 gap-1 text-xs text-muted-foreground"
              aria-label={`${agent.name}的模型与推理配置`}
            >
              <span className="truncate">{summary}</span>
              <ChevronDown className="size-3 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="w-80 space-y-3"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{agent.name}</span>
              <span className="text-xs text-muted-foreground">
                {busy ? "正在保存…" : "成员默认配置"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              用于这位成员之后的私聊和群聊。已运行、已排队的工作保持原配置。
            </p>
            <ExecutionPreferenceFields
              value={preferences}
              capabilities={inspection.capabilities}
              disabled={busy || unknown}
              onChange={(values) =>
                void save(
                  Object.fromEntries(
                    Object.entries(values).filter(
                      ([, value]) => typeof value === "string",
                    ),
                  ),
                )
              }
            />
            {inspection.loading && (
              <p role="status" className="text-xs text-muted-foreground">
                正在读取原生选项…
              </p>
            )}
            {(error || inspection.error) && (
              <p role="alert" className="text-xs text-destructive">
                {error || inspection.error}
              </p>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  inspection.reload();
                  if (await onRefresh()) {
                    setUnknown(false);
                    setError("");
                    onPending(false);
                  }
                }}
              >
                <RefreshCw className="size-3" />
                重新读取
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={href}>成员执行配置</Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
      <Button
        asChild
        size="sm"
        variant="ghost"
        className="max-w-48 text-xs text-muted-foreground"
      >
        <Link
          href={href}
          aria-label={`${agent.name}的运行环境`}
          title={binding?.label ?? "配置成员运行环境"}
        >
          <Monitor className="size-3.5 shrink-0" />
          <span className="truncate">{binding?.label ?? "配置运行环境"}</span>
        </Link>
      </Button>
    </div>
  );
}
