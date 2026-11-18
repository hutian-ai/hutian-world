"use client";
import { useState } from "react";
import { Input } from "@hutian-ai/design/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@hutian-ai/design/ui/table";
import { Button } from "@hutian-ai/design/ui/button";
import { Panel } from "./panel";
import { effortLabel } from "@/lib/execution-settings";
export function RuntimeModelCatalog({
  models,
}: {
  models: {
    id: string;
    name: string;
    efforts: string[];
    fastModeSupport: "supported" | "unsupported" | "unreported";
  }[];
}) {
  const [query, setQuery] = useState("");
  const visible = models.filter((m) =>
    `${m.name} ${m.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Panel
      title="模型与能力"
      description="支持极速模式的模型可在成员私聊输入框中点击闪电切换。"
      count={`${models.length} 个模型`}
    >
      {models.length > 5 && (
        <div className="border-b px-5 py-3">
          <Input
            className="max-w-xs"
            placeholder="搜索模型…"
            aria-label="搜索模型"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      {visible.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">可选模型</TableHead>
              <TableHead>可选思考强度</TableHead>
              <TableHead className="pr-5">极速模式支持</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="min-w-40 py-4 pl-5">
                  <span className="text-sm font-medium">{m.name}</span>
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">模型标识</summary>
                    <code className="mt-1 block max-w-72 break-all">
                      {m.id}
                    </code>
                  </details>
                </TableCell>
                <TableCell className="min-w-44 text-xs leading-6 text-muted-foreground">
                  {m.efforts.length
                    ? m.efforts.map(effortLabel).join(" / ")
                    : "未报告"}
                </TableCell>
                <TableCell className="min-w-36 pr-5 text-xs">
                  {m.fastModeSupport === "supported" ? (
                    <>
                      <span>支持</span>
                    </>
                  ) : m.fastModeSupport === "unsupported" ? (
                    "不支持"
                  ) : (
                    "未报告"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          {query
            ? "没有匹配的模型。"
            : "尚未报告模型目录，请在所在电脑的界舟中检查 Harness。"}
        </p>
      )}
    </Panel>
  );
}
export function CopyRuntimeDiagnostics({
  value,
}: {
  value: Record<string, unknown>;
}) {
  const [label, setLabel] = useState("复制诊断摘要");
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
          setLabel("已复制");
        } catch {
          setLabel("复制失败，请重试");
        }
      }}
    >
      {label}
    </Button>
  );
}
