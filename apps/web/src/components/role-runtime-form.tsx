"use client";

import Link from "@/lib/navigation";
import { useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import type {
  RoleRuntimeBinding,
  ExecutionPreferences,
} from "@hutian-world/contracts";
import {
  ExecutionPreferenceFields,
  useRuntimeCapabilities,
} from "./execution-preference-fields";
import type { RoleRuntimeChoice } from "@/lib/role-runtime";
import { saveRoleRuntime } from "@/lib/role-runtime-actions";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@hutian-ai/design/ui/alert";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@hutian-ai/design/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hutian-ai/design/ui/select";
import { Spinner } from "@hutian-ai/design/ui/spinner";

const key = (value: { nodeId: string; provider: string } | null) =>
  value ? `${value.nodeId}::${value.provider}` : "none";

export function RoleRuntimeForm({
  roleId,
  binding,
  choices,
  connectionError,
}: {
  roleId: string;
  binding: RoleRuntimeBinding | null;
  choices: RoleRuntimeChoice[];
  connectionError: string;
}) {
  const router = useRouter();
  const locked = useRef(false);
  const [selected, setSelected] = useState(key(binding));
  const [saved, setSaved] = useState(key(binding));
  const [preferences, setPreferences] = useState<ExecutionPreferences>(
    binding?.preferences ?? {},
  );
  const [savedPreferences, setSavedPreferences] = useState(
    JSON.stringify(binding?.preferences ?? {}),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choice = choices.find((runtime) => key(runtime) === selected);
  const capability = useRuntimeCapabilities(
    choice ? { nodeId: choice.nodeId, provider: choice.provider } : undefined,
  );
  const dirty =
    saved !== selected || savedPreferences !== JSON.stringify(preferences);
  const missing =
    binding && !choices.some((runtime) => key(runtime) === key(binding));
  const label =
    selected === "none"
      ? "未配置运行环境"
      : choice?.label || binding?.label || "请选择 Runtime";
  async function save() {
    if (locked.current || !dirty) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      if (selected !== "none" && !choice) {
        setError("所选 Runtime 暂不可用，请重新读取。");
        return;
      }
      const runtime = choice
        ? { nodeId: choice.nodeId, provider: choice.provider, preferences }
        : null;
      const result = await saveRoleRuntime(
        roleId,
        runtime,
        binding?.updatedAt ?? null,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(selected);
      setSavedPreferences(JSON.stringify(preferences));
      toast.success("执行配置已保存", { description: label });
      router.refresh();
    } catch {
      setError("保存结果待核对，请刷新成员配置后确认。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel flex flex-col">
      <div className="border-b px-5 py-4">
        <h2 className="text-[15px] font-semibold">执行配置</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          设置这位成员使用的电脑、Harness、模型、推理等级与执行权限。
        </p>
      </div>
      <div className="space-y-5 p-5">
        <div className="text-sm">
          <span className="text-muted-foreground">当前默认：</span>
          {binding?.label || "未设置"}
        </div>
        {connectionError && (
          <Alert>
            <AlertTitle>暂时读不到 Runtime 列表</AlertTitle>
            <AlertDescription>{connectionError}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="member-runtime">默认 Runtime</FieldLabel>
          <Select
            value={selected}
            onValueChange={(value) => {
              if (
                value === "none" ||
                choices.some((runtime) => key(runtime) === value)
              ) {
                setSelected(value);
                setPreferences({});
                setError("");
              }
            }}
            disabled={busy}
          >
            <SelectTrigger id="member-runtime" className="w-full max-w-xl">
              <SelectValue placeholder="请选择 Runtime">{label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未配置运行环境</SelectItem>
              {choices.map((runtime) => (
                <SelectItem key={key(runtime)} value={key(runtime)}>
                  {runtime.label}
                </SelectItem>
              ))}
              {missing && (
                <SelectItem value={key(binding)} disabled>
                  已保存 · {binding.label}（暂不可用）
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <FieldDescription>
            用于这位成员之后的私聊和群聊；已运行、已排队的工作及独立定时安排保持原配置。
          </FieldDescription>
        </Field>
        {selected !== "none" && (
          <div className="max-w-xl">
            <ExecutionPreferenceFields
              showPermissions
              value={preferences}
              capabilities={capability.capabilities}
              disabled={busy || capability.loading}
              onChange={(value) => {
                setPreferences(
                  Object.fromEntries(
                    Object.entries(value).filter(
                      ([, v]) => typeof v === "string",
                    ),
                  ),
                );
                setError("");
              }}
            />
            {capability.loading && (
              <p className="mt-2 text-xs text-muted-foreground">
                正在读取此 Runtime 的模型与权限选项…
              </p>
            )}
            {capability.error && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {capability.error}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          权限仅作用于该成员的工作，不修改执行端全局配置。
          <Link href="/runtimes" className="underline underline-offset-4">
            查看运行环境
          </Link>
        </p>
        {!connectionError && !choices.length && (
          <p className="text-sm text-muted-foreground">
            当前没有可选择的在线 Runtime，请先连接执行电脑。
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>执行配置保存未确认</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-4">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            capability.reload();
            router.refresh();
          }}
        >
          <RefreshCw />
          重新读取
        </Button>
        <Button
          size="sm"
          disabled={
            busy || !dirty || (selected !== "none" && !capability.capabilities)
          }
          onClick={() => void save()}
        >
          {busy ? <Spinner /> : <Save />}
          {busy ? "保存中…" : "保存执行配置"}
        </Button>
      </div>
    </section>
  );
}
