import { RefreshDockButton } from "@/components/dock-connection";
import { ObjectHeader } from "@/components/object-header";
import { PageNavigation } from "@/components/page-navigation";
import { Panel } from "@/components/panel";
import { RuntimeLogo } from "@/components/runtime-logo";
import { StatusBadge } from "@/components/status-badge";
import {
  RuntimeSummary,
  RuntimeMembers,
  RuntimeActiveWork,
  RuntimeRecentWork,
  runtimeTime,
  RuntimeAutoRefresh,
} from "@/components/runtime-activity";
import {
  RuntimeModelCatalog,
  CopyRuntimeDiagnostics,
} from "@/components/runtime-model-catalog";
import Link, { notFound } from "@/lib/navigation";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@hutian-ai/design/ui/alert";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@hutian-ai/design/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { z } from "zod";
import { getDockDevice, getRuntimeOverview } from "@/lib/dock";
import { deviceLabel, runtimeStatus } from "@/lib/runtime-display";
import { permissionLabel } from "@/lib/execution-settings";

export default async function RuntimeDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ nodeId: string; runtimeKey: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { nodeId, runtimeKey } = await params;
  if (
    !z.uuid().safeParse(nodeId).success ||
    !z.string().min(1).max(80).safeParse(runtimeKey).success
  )
    notFound();
  const view = (await searchParams).view;
  const selected = view === "models" || view === "history" ? view : "overview";
  const self = `/runtimes/${nodeId}/${encodeURIComponent(runtimeKey)}`;
  const input = { nodeId, provider: runtimeKey };
  const [result, activity] = await Promise.all([
    getDockDevice(nodeId),
    getRuntimeOverview(input).catch(() => null),
  ]);
  const deviceHref = `/runtimes/${nodeId}`;
  const host = result.state === "error" ? nodeId : deviceLabel(result.device);
  const runtime =
    result.state === "online"
      ? result.runtimes.find((r) => r.key === runtimeKey)
      : undefined;
  const title =
    runtime?.displayName ??
    (
      { codex: "Codex", dsh: "DeepSeek", zcode: "ZCode" } as Record<
        string,
        string
      >
    )[runtimeKey] ??
    runtimeKey;
  const unavailable =
    result.state === "offline"
      ? "电脑已离线，无法确认模型和能力。请在所在电脑启动界舟并检查连接；成员绑定和工作记录仍保留。"
      : result.state === "online"
        ? "这台电脑没有报告此 Runtime，请在界舟中检查安装与启用状态。"
        : result.message;
  const diagnostics = {
    device: nodeId,
    runtime: runtimeKey,
    status: runtime?.status ?? result.state,
    version: runtime?.version ?? null,
    capabilityCheckedAt: runtime?.checkedAt ?? null,
    observedAt: activity?.checkedAt ?? null,
  };
  return (
    <>
      <RuntimeAutoRefresh
        enabled={selected === "overview" && !!activity?.active.length}
      />
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
        description={`由 ${host} 提供执行环境。`}
        media={<RuntimeLogo driverKey={runtimeKey} className="size-6" />}
        metadata={
          <StatusBadge
            {...(runtime
              ? runtimeStatus(runtime.status)
              : {
                  value: "unavailable",
                  label: result.state === "offline" ? "电脑离线" : "状态未确认",
                })}
          />
        }
        action={<RefreshDockButton />}
      />
      <div className="flex min-w-0 flex-col gap-6">
        {(!runtime || runtime.status !== "ready") && (
          <Alert variant="destructive">
            <AlertTitle>需要检查运行环境</AlertTitle>
            <AlertDescription>
              {runtime
                ? runtime.message ||
                  (runtime.status === "disabled"
                    ? "此 Runtime 已在设备上停用，请在界舟中检查设置。"
                    : runtime.status === "not_found"
                      ? "设备未检测到安装，请在所在电脑检查 Harness。"
                      : "原生接口暂未就绪，请在所在电脑的界舟中查看诊断。")
                : unavailable}
              <Link href={deviceHref} className="mt-2 block underline">
                查看电脑连接与 Runtime 列表
              </Link>
            </AlertDescription>
          </Alert>
        )}
        {activity ? (
          <RuntimeSummary data={activity} />
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              本工作台的使用信息暂时读取失败，请刷新重试。模型能力与连接状态仍可单独查看。
            </AlertDescription>
          </Alert>
        )}
        <nav aria-label="Runtime 详情分区" className="flex gap-1 border-b pb-2">
          {[
            ["overview", "概览"],
            ["models", "模型与能力"],
            ["history", "工作记录"],
          ].map(([key, label]) => (
            <Button
              key={key}
              asChild
              variant={selected === key ? "secondary" : "ghost"}
              size="sm"
            >
              <Link
                href={`${self}?view=${key}`}
                aria-current={selected === key ? "page" : undefined}
              >
                {label}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="flex min-w-0 flex-col gap-6">
            {selected === "overview" && activity && (
              <RuntimeActiveWork data={activity} />
            )}
            {selected === "models" &&
              (runtime ? (
                <RuntimeModelCatalog models={runtime.models} />
              ) : (
                <Alert>
                  <AlertDescription>
                    当前无法读取模型目录；恢复连接后刷新。
                  </AlertDescription>
                </Alert>
              ))}
            {selected !== "models" && activity && (
              <RuntimeRecentWork
                key={`${nodeId}:${runtimeKey}:${selected}`}
                data={activity}
                input={input}
                preview={selected === "overview"}
                allHref={
                  selected === "overview" ? `${self}?view=history` : undefined
                }
              />
            )}
          </main>
          <aside className="flex min-w-0 flex-col gap-6">
            {activity && (
              <RuntimeMembers
                data={activity}
                models={runtime?.models}
                modes={runtime?.permissionModes}
              />
            )}
            <Panel
              title="执行能力"
              description="来自此环境的能力声明，不代表所有模型都支持。"
            >
              <dl className="space-y-4 p-5 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">所在电脑</dt>
                  <dd className="mt-1 break-all">
                    <Link href={deviceHref} className="hover:underline">
                      {host}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">图片输入</dt>
                  <dd className="mt-1">
                    {!runtime || runtime.imageInput === null
                      ? "未报告"
                      : runtime.imageInput
                        ? "接口支持，需选择可看图的模型"
                        : "未提供"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">会话延续</dt>
                  <dd className="mt-1">
                    {!runtime
                      ? "未确认"
                      : runtime.sessionResume
                        ? "支持原生会话延续"
                        : "未提供"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    可选执行权限
                  </dt>
                  <dd className="mt-1 text-xs leading-6">
                    {runtime?.permissionModes.length
                      ? runtime.permissionModes
                          .map((m) => permissionLabel(m.name))
                          .join(" / ")
                      : "未报告"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    能力最近检测
                  </dt>
                  <dd className="mt-1 text-xs">
                    {runtime?.checkedAt
                      ? runtimeTime(runtime.checkedAt)
                      : "未报告"}
                  </dd>
                </div>
              </dl>
            </Panel>
            <Collapsible className="overflow-hidden rounded-lg border bg-card">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto min-h-14 w-full justify-between rounded-none px-5 py-3"
                >
                  诊断与版本
                  <ChevronDown className="size-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 border-t p-5 text-xs">
                <dl className="space-y-3">
                  <div>
                    <dt className="text-muted-foreground">CLI 版本</dt>
                    <dd className="mt-1">{runtime?.version ?? "未报告"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Driver</dt>
                    <dd className="mt-1">{runtimeKey}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">设备编号</dt>
                    <dd className="mt-1 break-all font-mono">{nodeId}</dd>
                  </div>
                </dl>
                <p className="leading-5 text-muted-foreground">
                  安装、登录和原生全局配置由所在电脑的界舟与 Harness
                  管理。这里的刷新只读取状态，不会试跑模型。
                </p>
                <CopyRuntimeDiagnostics value={diagnostics} />
              </CollapsibleContent>
            </Collapsible>
          </aside>
        </div>
      </div>
    </>
  );
}
