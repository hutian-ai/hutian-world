import Link from "@/lib/navigation";
import { ChevronDown } from "lucide-react";
import { notFound } from "@/lib/navigation";
import { z } from "zod";
import { RefreshDockButton } from "@/components/dock-connection";
import { RuntimeLogo } from "@/components/runtime-logo";
import { ObjectHeader } from "@/components/object-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@hutian-ai/design/ui/alert";
import { Badge } from "@hutian-ai/design/ui/badge";
import { PageNavigation } from "@/components/page-navigation";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@hutian-ai/design/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@hutian-ai/design/ui/table";

import { getDockDevice } from "@/lib/dock";
import { deviceLabel, runtimeStatus } from "@/lib/runtime-display";

export default async function RuntimeDetailsPage({
  params,
}: {
  params: Promise<{ nodeId: string; runtimeKey: string }>;
}) {
  const { nodeId, runtimeKey } = await params;
  if (!z.uuid().safeParse(nodeId).success) notFound();

  const deviceHref = `/runtimes/${nodeId}`;
  const result = await getDockDevice(nodeId);
  const host = result.state === "error" ? nodeId : deviceLabel(result.device);
  const runtime =
    result.state === "online"
      ? result.runtimes.find((item) => item.key === runtimeKey)
      : undefined;
  const title = runtime?.displayName ?? "Runtime 详情";
  const message =
    result.state === "offline"
      ? "设备当前离线，请连接设备后刷新。"
      : result.state === "online"
        ? "这台设备当前没有报告这个 Runtime。返回电脑详情可查看最新列表。"
        : result.message;
  return (
    <>
      <PageNavigation
        items={[
          { label: "运行环境", href: "/runtimes" },
          { label: host, href: deviceHref },
          { label: title },
        ]}
      />
      <ObjectHeader
        eyebrow="Runtime"
        title={title}
        description={
          runtime ? `由 ${host} 提供。` : "查看设备报告的模型与运行状态。"
        }
        media={<RuntimeLogo driverKey={runtimeKey} className="size-6" />}
        metadata={runtime && <StatusBadge {...runtimeStatus(runtime.status)} />}
        action={<RefreshDockButton />}
      />
      {runtime ? (
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="模型"
            description="查看设备报告的模型与执行选项。此页仅供查看，默认值由原生 Harness 管理。"
          >
            {runtime.models.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">模型</TableHead>
                    <TableHead>推理档位</TableHead>
                    <TableHead className="pr-5">服务档位</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runtime.models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="py-4 pl-5">
                        <span className="text-sm font-medium">
                          {model.name}
                        </span>
                        {model.current && (
                          <Badge variant="outline" className="ml-2">
                            当前模型
                          </Badge>
                        )}
                        {model.name !== model.id && (
                          <code className="mt-1 block break-all text-xs text-muted-foreground">
                            {model.id}
                          </code>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {model.efforts.join(" / ") || "未报告"}
                      </TableCell>
                      <TableCell className="pr-5 text-xs text-muted-foreground">
                        {model.serviceTiers.join(" / ") || "未报告"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                此 Runtime 尚未报告模型目录。可在这台电脑的界舟中检查
                Harness，再刷新状态。
              </p>
            )}
          </Panel>
          <Collapsible className="group/technical overflow-hidden rounded-lg border bg-card">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto min-h-14 w-full justify-between rounded-none px-5 py-3 text-left"
              >
                <span>
                  <strong className="block text-sm">技术详情</strong>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Driver、CLI 和设备 ID
                  </span>
                </span>
                <ChevronDown className="shrink-0 transition-transform group-data-[state=open]/technical:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <dl className="definition-grid border-t p-5">
                <div>
                  <dt>所在电脑</dt>
                  <dd>
                    <Link
                      href={deviceHref}
                      prefetch={false}
                      className="hover:underline"
                    >
                      {host}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>上下文延续</dt>
                  <dd>
                    {runtime.sessionResume
                      ? "支持原生会话延续"
                      : "未报告原生会话延续"}
                  </dd>
                </div>
                <div>
                  <dt>Driver</dt>
                  <dd>
                    <code className="break-all">{runtime.key}</code>
                  </dd>
                </div>
                <div>
                  <dt>CLI 版本</dt>
                  <dd>{runtime.version || "未报告"}</dd>
                </div>
                <div>
                  <dt>Dock 设备 ID</dt>
                  <dd>
                    <code className="break-all">{nodeId}</code>
                  </dd>
                </div>
              </dl>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>无法读取 Runtime 详情</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
