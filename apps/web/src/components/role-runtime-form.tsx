"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import type { RoleRuntimeBinding } from "@hutian-world/contracts";
import type { RoleRuntimeChoice } from "@/lib/role-runtime";
import { saveRoleRuntime } from "@/lib/role-runtime-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const key = (value: { nodeId: string; provider: string } | null) => value ? `${value.nodeId}::${value.provider}` : "none";

export function RoleRuntimeForm({ roleId, binding, choices, connectionError }: {
  roleId: string; binding: RoleRuntimeBinding | null; choices: RoleRuntimeChoice[]; connectionError: string;
}) {
  const router = useRouter();
  const locked = useRef(false);
  const [selected, setSelected] = useState(key(binding));
  const [saved, setSaved] = useState(key(binding));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choice = choices.find(runtime => key(runtime) === selected);
  const missing = binding && !choices.some(runtime => key(runtime) === key(binding));
  const label = selected === "none" ? "不设默认，发送时选择" : choice?.label || binding?.label || "请选择 Runtime";
  async function save() {
    if (locked.current || saved === selected) return;
    locked.current = true; setBusy(true); setError("");
    try {
      if (selected !== "none" && !choice) { setError("所选 Runtime 暂不可用，请重新读取。"); return; }
      const runtime = choice ? { nodeId: choice.nodeId, provider: choice.provider } : null;
      const result = await saveRoleRuntime(roleId, runtime, binding?.updatedAt ?? null);
      if (!result.ok) { setError(result.error); return; }
      setSaved(selected);
      toast.success("执行配置已保存", { description: label });
      router.refresh();
    } catch { setError("保存结果待核对，请刷新成员配置后确认。"); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section className="panel flex flex-col">
    <div className="border-b px-5 py-4">
      <h2 className="text-[15px] font-semibold">执行配置</h2>
      <p className="mt-1 text-xs text-muted-foreground">选择这位成员默认使用的电脑与 Harness。</p>
    </div>
    <div className="space-y-5 p-5">
      <div className="text-sm"><span className="text-muted-foreground">当前默认：</span>{binding?.label || "未设置"}</div>
      {connectionError && <Alert><AlertTitle>暂时读不到 Runtime 列表</AlertTitle><AlertDescription>{connectionError}</AlertDescription></Alert>}
      <Field>
        <FieldLabel htmlFor="member-runtime">默认 Runtime</FieldLabel>
        <Select value={selected} onValueChange={value => { if (value === "none" || choices.some(runtime => key(runtime) === value)) { setSelected(value); setError(""); } }} disabled={busy}>
          <SelectTrigger id="member-runtime" className="w-full max-w-xl"><SelectValue placeholder="请选择 Runtime">{label}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">不设默认，发送时选择</SelectItem>
            {choices.map(runtime => <SelectItem key={key(runtime)} value={key(runtime)}>{runtime.label}</SelectItem>)}
            {missing && <SelectItem value={key(binding)} disabled>已保存 · {binding.label}（暂不可用）</SelectItem>}
          </SelectContent>
        </Select>
        <FieldDescription>新请求默认使用这里的设置；聊天中仍可临时选择其他 Runtime。变更不会转移或重新派发已经开始的运行。</FieldDescription>
      </Field>
      <p className="text-xs text-muted-foreground">模型、思考强度和权限沿用执行端配置。<Link href="/runtimes" className="underline underline-offset-4">查看运行环境</Link></p>
      {!connectionError && !choices.length && <p className="text-sm text-muted-foreground">当前没有可选择的在线 Runtime，请先连接执行电脑。</p>}
      {error && <Alert variant="destructive"><AlertTitle>执行配置保存未确认</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
    <div className="flex items-center justify-end gap-2 border-t bg-card px-5 py-4">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => router.refresh()}><RefreshCw />重新读取</Button>
      <Button size="sm" disabled={busy || saved === selected} onClick={() => void save()}>{busy ? <Spinner /> : <Save />}{busy ? "保存中…" : "保存执行配置"}</Button>
    </div>
  </section>;
}
