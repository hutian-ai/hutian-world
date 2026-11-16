import Link from "@/lib/navigation";
import { ArrowRight, HardDrive, ServerCog } from "lucide-react";
import { notFound } from "@/lib/navigation";
import { z } from "zod";
import { RefreshDockButton } from "@/components/dock-connection";
import { EmptyState } from "@/components/empty-state";
import { ObjectHeader } from "@/components/object-header";
import { RuntimeLogo } from "@/components/runtime-logo";
import { StatusBadge } from "@/components/status-badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@hutian-ai/design/ui/alert";
import { Badge } from "@hutian-ai/design/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@hutian-ai/design/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@hutian-ai/design/ui/table";
import { getDockDevice } from "@/lib/dock";
import {
  deviceLabel,
  deviceStatus,
  runtimeStatus,
} from "@/lib/runtime-display";

export default async function RuntimeDevicePage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;
  if (!z.uuid().safeParse(nodeId).success) notFound();
  const result = await getDockDevice(nodeId);
  const title =
    result.state === "error" ? "电脑详情" : deviceLabel(result.device);
  const runtimes = result.state === "online" ? result.runtimes : [];
  const availableCount = runtimes.filter(
    (runtime) => runtime.status === "ready",
  ).length;
  return (
    <>
      <ObjectHeader
        path={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/runtimes" prefetch={false}>
                    运行环境
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        media={<HardDrive className="size-5" />}
        title={title}
        description="查看这台电脑的当前连接状态及其 Runtime。"
        metadata={
          <>
            {(result.state === "online" || result.state === "offline") && (
              <StatusBadge {...deviceStatus(result.device.connected)} />
            )}
            {result.state === "online" && (
              <Badge variant="outline">{availableCount} 个可用 Runtime</Badge>
            )}
          </>
        }
        action={<RefreshDockButton />}
      />
      <section
        aria-labelledby="runtime-instance-directory-title"
        className="min-w-0"
      >
        <header className="flex items-end justify-between gap-4 px-1 pb-3">
          <div>
            <h2
              id="runtime-instance-directory-title"
              className="text-[15px] font-semibold"
            >
              Runtime
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              当前由这台电脑提供的执行环境。
            </p>
          </div>
          {result.state === "online" && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              共 {runtimes.length} 个
            </span>
          )}
        </header>
        <div className="overflow-hidden rounded-lg border bg-card">
          {result.state === "error" || result.state === "unknown" ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTitle>无法确认 Runtime</AlertTitle>
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
            </div>
          ) : result.state === "offline" ? (
            <EmptyState
              title="设备离线"
              detail="请确认这台电脑上的 Harness Dock 后台已启动并连到同一个 Dock Server。"
              icon={HardDrive}
            />
          ) : !runtimes.length ? (
            <EmptyState
              title="设备没有报告 Runtime"
              detail="在这台电脑的 Harness Dock 中检查原生 Harness，再刷新状态。"
              icon={ServerCog}
            />
          ) : (
            <Table className="min-w-[400px] table-fixed">
              <TableHeader className="bg-background/20">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[45%] px-4 text-[10px] text-muted-foreground">
                    运行时
                  </TableHead>
                  <TableHead className="w-24 text-[10px] text-muted-foreground">
                    当前状态
                  </TableHead>
                  <TableHead className="text-[10px] text-muted-foreground">
                    模型
                  </TableHead>
                  <TableHead className="w-28 pr-4">
                    <span className="sr-only">详情</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runtimes.map((runtime) => (
                  <TableRow
                    key={runtime.key}
                    className="group/row relative h-16 cursor-pointer transition-colors duration-150 focus-within:bg-surface-active hover:bg-surface-active"
                  >
                    <TableCell className="px-4">
                      <Link
                        href={`/runtimes/${nodeId}/${encodeURIComponent(runtime.key)}`}
                        prefetch={false}
                        aria-label={`查看 ${runtime.displayName} 详情`}
                        className="flex w-fit max-w-full items-center gap-3 outline-none after:absolute after:inset-0 after:z-10 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center">
                          <RuntimeLogo
                            driverKey={runtime.key}
                            className="size-[22px]"
                          />
                        </span>
                        <div className="min-w-0">
                          <strong className="block truncate text-[13px] font-semibold">
                            {runtime.displayName}
                          </strong>
                          {runtime.version && (
                            <span className="block truncate text-[10px] text-muted-foreground">
                              {runtime.version}
                            </span>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge {...runtimeStatus(runtime.status)} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {runtime.models.length
                        ? `${runtime.models.length} 个`
                        : "未报告"}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground transition-colors group-focus-within/row:text-foreground group-hover/row:text-foreground">
                        查看详情{" "}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </>
  );
}
