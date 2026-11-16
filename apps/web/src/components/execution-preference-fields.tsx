"use client";
import { useEffect, useState } from "react";
import type { ExecutionPreferences } from "@hutian-world/contracts";
import { readRuntimeCapabilities } from "@/lib/execution-settings-actions";
import {
  effortLabel,
  permissionLabel,
  type RuntimeCapabilities,
} from "@/lib/execution-settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hutian-ai/design/ui/select";

export function useRuntimeCapabilities(
  runtime?: { nodeId: string; provider: string },
  enabled = true,
) {
  const key = runtime ? `${runtime.nodeId}:${runtime.provider}` : "";
  const [state, setState] = useState<{
    key: string;
    capabilities?: RuntimeCapabilities;
    error?: string;
  }>({ key: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !runtime) return;
    let cancelled = false;
    setState({ key });
    readRuntimeCapabilities({
      nodeId: runtime.nodeId,
      provider: runtime.provider,
    })
      .then((result) => {
        if (!cancelled)
          setState(
            result.ok
              ? { key, capabilities: result.capabilities }
              : { key, error: result.error },
          );
      })
      .catch(() => {
        if (!cancelled)
          setState({ key, error: "配置读取未确认，请重新读取。" });
      });
    return () => {
      cancelled = true;
    };
  }, [key, enabled, revision]);
  return {
    capabilities: state.key === key ? state.capabilities : undefined,
    error: state.key === key ? state.error : undefined,
    loading: Boolean(
      enabled &&
      key &&
      (state.key !== key || (!state.capabilities && !state.error)),
    ),
    reload: () => setRevision((v) => v + 1),
  };
}

export function ExecutionPreferenceFields({
  value,
  capabilities,
  onChange,
  disabled,
  showPermissions = false,
}: {
  value: ExecutionPreferences;
  capabilities?: RuntimeCapabilities;
  disabled?: boolean;
  showPermissions?: boolean;
  onChange(value: ExecutionPreferences): void;
}) {
  const model = capabilities?.models.find(
    (m) => m.id === (value.model ?? capabilities.current.model),
  );
  function field(
    key: keyof ExecutionPreferences,
    title: string,
    options: Array<{ value: string; label: string }>,
  ) {
    const selected = value[key] ?? "inherit";
    const defaultValue = capabilities?.current[key];
    const label =
      key === "mode"
        ? (v: string) =>
            permissionLabel(
              capabilities?.permissionModes.find((mode) => mode.id === v)
                ?.name ?? v,
            )
        : key === "effort"
          ? effortLabel
          : (v: string) =>
              key === "serviceTier" && v === "priority" ? "优先" : v;
    return (
      <label className="grid min-w-0 gap-1.5 text-xs">
        <span className="text-muted-foreground">{title}</span>
        <Select
          value={selected}
          disabled={disabled || !capabilities}
          onValueChange={(v) => {
            if (!v) return;
            const next = { ...value };
            if (v === "inherit") delete next[key];
            else next[key] = v;
            if (key === "model") {
              delete next.effort;
              delete next.serviceTier;
            }
            onChange(next);
          }}
        >
          <SelectTrigger aria-label={title} className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inherit">
              {key === "mode" ? "跟随执行端" : "跟随原生"}
              {defaultValue ? `（${label(defaultValue)}）` : ""}
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            {selected !== "inherit" &&
              !options.some((o) => o.value === selected) && (
                <SelectItem value={selected} disabled>
                  {label(selected)}（{capabilities ? "暂不可用" : "未确认"}）
                </SelectItem>
              )}
          </SelectContent>
        </Select>
      </label>
    );
  }
  return (
    <div className="grid gap-3">
      {field(
        "model",
        "模型",
        capabilities?.models.map((m) => ({ value: m.id, label: m.name })) ?? [],
      )}
      {field(
        "effort",
        "推理等级",
        model?.efforts.map((value) => ({ value, label: effortLabel(value) })) ??
          [],
      )}
      {showPermissions && (
        <div className="grid gap-1.5">
          {field(
            "mode",
            "执行权限",
            capabilities?.permissionModes.map((mode) => ({
              value: mode.id,
              label: permissionLabel(mode.name),
            })) ?? [],
          )}
          <p className="text-xs text-muted-foreground">
            {capabilities && !capabilities.permissionModes.length
              ? "此 Runtime 未报告可配置的权限模式，仅可跟随执行端。"
              : "用于这位成员之后的私聊和群聊；执行时由 Runtime 校验并确认。"}
          </p>
        </div>
      )}
      {/* Service tiers remain read-only in Runtime details until the installed
        device adapters confirm forwarding; discovery alone is insufficient. */}
    </div>
  );
}
