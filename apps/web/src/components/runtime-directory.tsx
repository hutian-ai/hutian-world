"use client";

import Link from "@/lib/navigation";
import { useState } from "react";
import { ArrowRight, HardDrive, Search } from "lucide-react";
import { RefreshDockButton } from "@/components/dock-connection";
import { EmptyState } from "@/components/empty-state";
import { RuntimeLogo } from "@/components/runtime-logo";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@hutian-ai/design/ui/button";
import { Input } from "@hutian-ai/design/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hutian-ai/design/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@hutian-ai/design/ui/table";
import type { DockDirectoryDevice } from "@/lib/dock";
import { deviceLabel, deviceStatus } from "@/lib/runtime-display";

const platformNames: Record<string, string> = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux",
};

export function RuntimeDirectory({
  devices,
  endpoint,
}: {
  devices: DockDirectoryDevice[];
  endpoint: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const query = search.trim().toLocaleLowerCase();
  const results = devices.filter((device) => {
    const matches =
      `${deviceLabel(device)} ${device.nodeId} ${device.hostname ?? ""} ${device.runtimes.map((r) => `${r.displayName} ${r.key}`).join(" ")}`
        .toLocaleLowerCase()
        .includes(query);
    return (
      matches &&
      (status === "all" || (status === "online") === device.connected)
    );
  });
  const online = devices.filter((device) => device.connected).length;
  const filtered = !!query || status !== "all";
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="relative w-full max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            className="h-8 pl-8"
            aria-label="搜索机器或 Harness"
            placeholder="搜索机器或 Harness…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" aria-label="机器状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部机器</SelectItem>
            <SelectItem value="online">在线</SelectItem>
            <SelectItem value="offline">离线</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatus("all");
            }}
          >
            清除筛选
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground" role="status">
            {filtered
              ? `${results.length} 台匹配`
              : `${online} / ${devices.length} 台在线`}
          </span>
          <RefreshDockButton />
        </div>
      </div>
      {results.length ? (
        <Table className="min-w-[620px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%] pl-5">机器编号</TableHead>
              <TableHead>Harness</TableHead>
              <TableHead className="w-28">可用 Runtime</TableHead>
              <TableHead className="w-24">连接状态</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">打开机器</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((device) => (
              <TableRow
                key={device.nodeId}
                className="group relative h-20 focus-within:bg-surface-active"
              >
                <TableCell className="pl-5">
                  <Link
                    href={`/runtimes/${device.nodeId}`}
                    prefetch={false}
                    className="flex min-w-0 items-center gap-3 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                  >
                    <HardDrive className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <strong
                        className="block truncate text-sm font-medium"
                        title={device.nodeId}
                      >
                        {deviceLabel(device)}
                      </strong>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {[
                          device.platform &&
                            (platformNames[device.platform] ?? device.platform),
                          device.hostname,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "设备信息未报告"}
                      </span>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  {device.inventoryState === "online" ? (
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                      {device.runtimes
                        .filter(
                          (r) =>
                            r.status !== "not_found" && r.status !== "disabled",
                        )
                        .map((r) => (
                          <span
                            key={r.key}
                            className="inline-flex items-center gap-1.5 text-xs"
                          >
                            <RuntimeLogo driverKey={r.key} className="size-4" />
                            {r.displayName}
                          </span>
                        ))}
                      {!device.runtimes.some(
                        (r) =>
                          r.status !== "not_found" && r.status !== "disabled",
                      ) && (
                        <span className="text-xs text-muted-foreground">
                          暂无已启用的 Harness
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {device.inventoryState === "offline"
                        ? "连接后读取"
                        : device.message || "读取未确认"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {device.inventoryState === "online"
                    ? `${device.runtimes.filter((r) => r.status === "ready").length} 个`
                    : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge {...deviceStatus(device.connected)} />
                </TableCell>
                <TableCell>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title={filtered ? "没有匹配的机器" : "还没有已授权的机器"}
          detail={
            filtered
              ? "调整搜索关键词或清除状态筛选。"
              : "在界舟中连接电脑，并在 Dock Server 将它授权给 Hutian，再刷新列表。"
          }
          icon={HardDrive}
        />
      )}
      <footer className="border-t px-5 py-3 text-xs text-muted-foreground">
        目录来源 <span className="break-all">{endpoint}</span> · 选择机器查看其
        Runtime
      </footer>
    </>
  );
}
