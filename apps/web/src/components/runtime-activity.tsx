"use client";
import { useEffect, useState, useRef } from "react";
import type {
  ExecutionPreferences,
  RuntimeOverview,
  RuntimeOverviewInput,
} from "@hutian-world/contracts";
import { getRuntimeOverview } from "@/lib/dock";
import Link from "@/lib/navigation";
import { effortLabel, permissionLabel } from "@/lib/execution-settings";
import { RoleChatButton } from "./role-chat-button";
import { Panel } from "./panel";
import { StatusBadge } from "./status-badge";
import { Button } from "@hutian-ai/design/ui/button";
import { Input } from "@hutian-ai/design/ui/input";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { ArrowUpRight, Loader2, Users } from "lucide-react";

export function runtimeTime(value: string | null) {
  return value
    ? new Date(value).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "暂无记录";
}
export function workloadLabel(rows: RuntimeOverview["summaries"]) {
  const running = rows.reduce((n, r) => n + r.running, 0),
    queued = rows.reduce((n, r) => n + r.queued, 0),
    attention = rows.reduce((n, r) => n + r.attention, 0);
  return (
    [
      running ? `${running} 进行中` : null,
      queued ? `${queued} 等待执行` : null,
      attention ? `${attention} 待处理 / 核对` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "暂无进行中的工作"
  );
}
const stateLabels: Record<string, string> = {
  accepted: "已接收",
  queued: "等待执行",
  preparing: "准备 / 交付中",
  running: "进行中",
  waiting_permission: "等待授权",
  blocked: "需要处理",
  unknown: "待核对",
  replied: "已交付",
  completed: "执行完成",
  failed: "失败",
  cancelled: "已停止",
  missed: "未执行",
  skipped: "已跳过",
};
export function preferenceText(
  value: ExecutionPreferences,
  modes: { id: string; name: string }[] = [],
) {
  const mode = value.mode
    ? permissionLabel(
        modes.find((m) => m.id === value.mode)?.name ??
          (
            {
              yolo: "Full access",
              build: "变更前确认",
              plan: "规划",
              edit: "自动编辑",
              guarded: "受限执行",
            } as Record<string, string>
          )[value.mode] ??
          value.mode,
      )
    : "默认权限";
  return [
    value.effort ? `思考：${effortLabel(value.effort)}` : "默认思考强度",
    mode,
    value.serviceTier === "priority" ? "极速：开启" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function RuntimeSummary({ data }: { data: RuntimeOverview }) {
  const sum = (key: "running" | "queued" | "attention" | "total") =>
    data.summaries.reduce((n, r) => n + r[key], 0);
  return (
    <div>
      <dl className="grid grid-cols-2 divide-x divide-border rounded-lg border bg-card py-4 sm:grid-cols-4">
        {[
          ["进行中", sum("running")],
          ["等待执行", sum("queued")],
          ["待处理 / 核对", sum("attention")],
          ["使用成员", data.members.length],
        ].map(([name, value]) => (
          <div key={name} className="px-5 py-1">
            <dt className="text-xs text-muted-foreground">{name}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        仅统计本工作台的工作 · 状态由后台同步 · 读取于{" "}
        {runtimeTime(data.checkedAt)}
      </p>
    </div>
  );
}
export function RuntimeMembers({
  data,
  models = [],
  modes = [],
}: {
  data: RuntimeOverview;
  models?: { id: string; name: string }[];
  modes?: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const members = data.members.filter((m) =>
    m.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <Panel
      title="使用成员"
      description="模型与执行偏好归成员；修改后用于新工作。"
      count={`${data.members.length} 位`}
    >
      {data.members.length > 5 && (
        <div className="border-b p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索成员…"
            aria-label="搜索使用成员"
          />
        </div>
      )}
      <div className="max-h-96 overflow-y-auto divide-y">
        {members.map((m) => (
          <div key={m.id} className="p-4">
            <Link
              href={`/members/${m.id}?view=settings&section=runtime`}
              className="flex items-center justify-between gap-2 text-sm font-medium hover:underline"
            >
              {m.name}
              <ArrowUpRight className="size-3.5 text-muted-foreground" />
            </Link>
            <p className="mt-2 break-all text-xs">
              {models.find((model) => model.id === m.preferences.model)?.name ??
                m.preferences.model ??
                "跟随默认模型"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {preferenceText(m.preferences, modes)}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <Link
                href={`/members/${m.id}?view=settings&section=runtime`}
                className="text-primary hover:underline"
              >
                执行设置
              </Link>
              <RoleChatButton roleId={m.id} variant="outline" />
            </div>
          </div>
        ))}
      </div>
      {!members.length && (
        <div className="p-5 text-sm text-muted-foreground">
          <Users className="mb-2 size-5" />
          {query
            ? "没有匹配的成员"
            : "还没有成员绑定此环境。在成员执行设置中选择即可使用。"}
        </div>
      )}
      <div className="border-t px-4 py-3">
        <Link className="text-xs text-primary hover:underline" href="/members">
          管理成员
        </Link>
      </div>
    </Panel>
  );
}
function WorkRows({ rows }: { rows: RuntimeOverview["recent"] }) {
  return (
    <div className="divide-y">
      {rows.map((row) => (
        <div
          key={`${row.source}/${row.id}`}
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={row.href}
              className="inline-flex max-w-full items-center gap-2 text-sm font-medium hover:underline"
            >
              <span className="truncate">{row.title}</span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
            </Link>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{row.source === "schedule" ? "定时工作" : "聊天"}</span>
              <span>{row.member}</span>
              <span>{runtimeTime(row.createdAt)}</span>
            </div>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="w-fit cursor-pointer hover:text-foreground">
                提交配置
              </summary>
              <p className="mt-2 break-all leading-5">
                {row.model ?? "跟随默认模型"} ·{" "}
                {preferenceText(row.preferences)}
              </p>
              <p className="mt-1 leading-5">
                此处为发起时冻结的配置；原生生效结果以原工作回执为准。
              </p>
              <p className="mt-1">记录更新：{runtimeTime(row.updatedAt)}</p>
            </details>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge
              value={row.state === "replied" ? "completed" : row.state}
              label={stateLabels[row.state] ?? "待核对"}
            />
            <Link
              href={row.href}
              className="text-xs text-primary hover:underline"
            >
              {row.source === "schedule" ? "打开工作" : "打开会话"}
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
export function RuntimeActiveWork({ data }: { data: RuntimeOverview }) {
  return (
    <Panel
      title="当前工作"
      description="处理授权、停止或查看进度，请进入对应的原工作。"
      count={`${data.active.length}${data.activeHasMore ? "+" : ""} 项`}
    >
      {data.active.length ? (
        <WorkRows rows={data.active} />
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          本工作台暂无进行中或待处理的工作。
        </p>
      )}
      {data.activeHasMore && (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          显示最近 50 项，请从下方工作记录继续查阅。
        </p>
      )}
    </Panel>
  );
}
export function RuntimeRecentWork({
  data,
  input,
  preview = false,
  allHref,
}: {
  data: RuntimeOverview;
  input: RuntimeOverviewInput;
  preview?: boolean;
  allHref?: string;
}) {
  const generation = useRef(0);
  const [expanded, setExpanded] = useState(!preview);
  const [rows, setRows] = useState(data.recent),
    [cursor, setCursor] = useState(data.nextCursor),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    generation.current++;
    setBusy(false);
    setRows(data.recent);
    setCursor(data.nextCursor);
    setError("");
    return () => {
      generation.current++;
    };
  }, [data]);
  async function more() {
    const revision = generation.current;
    setBusy(true);
    setError("");
    try {
      const next = await getRuntimeOverview({ ...input, cursor: cursor! });
      if (revision !== generation.current) return;
      setRows((old) => [
        ...old,
        ...next.recent.filter(
          (r) => !old.some((o) => o.id === r.id && o.source === r.source),
        ),
      ]);
      setCursor(next.nextCursor);
    } catch {
      if (revision === generation.current)
        setError("工作记录读取失败，请重试。");
    } finally {
      if (revision === generation.current) setBusy(false);
    }
  }
  return (
    <Panel
      title={preview && !expanded ? "近期工作" : "工作记录"}
      description="保留发起时的成员与 Runtime 关联，不随之后的换绑改变。"
    >
      {rows.length ? (
        <WorkRows rows={expanded ? rows : rows.slice(0, 5)} />
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          暂无工作记录。通过成员发起工作后会显示在这里。
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!expanded && (rows.length > 5 || cursor || allHref) && (
        <div className="border-t px-5 py-3">
          {allHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={allHref}>查看全部工作记录</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(true)}
            >
              查看全部工作记录
            </Button>
          )}
        </div>
      )}
      {expanded && cursor && (
        <div className="border-t px-5 py-3">
          <Button variant="outline" size="sm" onClick={more} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}加载更多
          </Button>
        </div>
      )}
    </Panel>
  );
}

export function RuntimeAutoRefresh({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        window.dispatchEvent(new Event("hutian:refresh"));
    }, 15000);
    return () => clearInterval(timer);
  }, [enabled]);
  return null;
}
