"use client";
import { api } from "@/lib/api";
import { useRouter } from "@/lib/navigation";
import { loadSchedule, previewScheduleRule } from "@/lib/schedule-actions";
import {
  scheduleAt,
  scheduledWorkHref,
  scheduleHref,
  scheduleStatusLabels,
} from "@/lib/schedule-display";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { Badge } from "@hutian-ai/design/ui/badge";
import { Button } from "@hutian-ai/design/ui/button";
import type {
  Page,
  ScheduledRun,
  ScheduledTask,
} from "@hutian-world/contracts";
import { useCallback, useEffect, useState } from "react";
import { PageNavigation } from "./page-navigation";
import { ScheduleActions } from "./schedule-actions";
import { ScheduleRuns } from "./schedule-runs";
import { ScheduleSummary } from "./schedule-summary";

export function ScheduleDetail({
  initial,
  roleName,
  roles,
  returnTo,
}: {
  initial: {
    task: ScheduledTask;
    runs: ScheduledRun[];
    nextCursor?: string | null;
  };
  roleName: string;
  roles: { id: string; name: string }[];
  returnTo: string;
}) {
  const [data, setData] = useState(initial),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewScheduleRule>
  > | null>(null);
  const router = useRouter();
  const refresh = useCallback(async () => {
    const result = await loadSchedule(initial.task.id);
    if (result.ok) {
      setData((old) => ({
        task: result.task,
        runs: [
          ...new Map(
            [...result.runs, ...old.runs].map((run) => [run.id, run]),
          ).values(),
        ],
        nextCursor:
          old.runs.length > result.runs.length
            ? old.nextCursor
            : result.nextCursor,
      }));
      setError("");
      return result.task;
    }
    setError(result.error);
    return null;
  }, [initial.task.id]);
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  const ruleKey = JSON.stringify(data.task.rule);
  useEffect(() => {
    let current = true;
    setPreview(null);
    void previewScheduleRule(JSON.parse(ruleKey)).then((value) => {
      if (current) setPreview(value);
    });
    return () => {
      current = false;
    };
  }, [ruleKey]);
  const [loadingMore, setLoadingMore] = useState(false);
  async function loadMore() {
    if (!data.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api<Page<ScheduledRun>>(
        `/v2/scheduled-runs?${new URLSearchParams({ scheduleId: data.task.id, cursor: data.nextCursor })}`,
      );
      setData((old) => ({
        ...old,
        runs: [
          ...new Map(
            [...old.runs, ...page.items].map((run) => [run.id, run]),
          ).values(),
        ],
        nextCursor: page.nextCursor,
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : "较早运行暂不可读取。");
    } finally {
      setLoadingMore(false);
    }
  }
  const { task, runs } = data;
  return (
    <div className="space-y-6">
      <PageNavigation
        items={[{ label: "定时任务", href: returnTo }, { label: task.title }]}
      />
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:flex-1">
          <h1 className="min-w-0 break-words text-2xl font-semibold">
            {task.title}
          </h1>
          <Badge variant="outline">{scheduleStatusLabels[task.status]}</Badge>
        </div>
        <ScheduleActions
          task={task}
          returnTo={returnTo}
          onChanged={async () => {
            const task = await refresh();
            if (task?.deletedAt) {
              const url = new URL(returnTo, location.origin);
              url.searchParams.delete("selected");
              router.replace(url.pathname + url.search);
            }
          }}
        />
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error} 当前内容可能不是最新状态。
          </AlertDescription>
        </Alert>
      )}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-8">
          <ScheduleSummary task={task} roleName={roleName} showStatus={false} />
          <section className="space-y-3 border-t pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">运行记录</h2>
              <span className="text-xs text-muted-foreground">
                最近 {runs.length} 条
              </span>
            </div>
            <ScheduleRuns
              compact
              roles={roles}
              runs={runs}
              select={(run) =>
                router.push(
                  scheduledWorkHref(run.id, scheduleHref(task.id, returnTo)),
                )
              }
            />
            {data.nextCursor && (
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "正在读取…" : "读取较早运行"}
              </Button>
            )}
          </section>
        </div>
        {task.status !== "deleted" && (
          <aside className="space-y-3 border-t pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            <h2 className="text-sm font-semibold">
              {task.enabled ? "后续预计" : "启用后的预计时间"}
            </h2>
            <p className="text-xs leading-6 text-muted-foreground">
              {task.rule.timeZone}
            </p>
            {!preview ? (
              <p role="status" className="text-xs text-muted-foreground">
                正在读取…
              </p>
            ) : !preview.ok ? (
              <p className="text-xs text-destructive">{preview.error}</p>
            ) : preview.starts.length ? (
              <ol className="space-y-3 text-xs">
                {preview.starts.map((at) => (
                  <li key={at}>{scheduleAt(at, task.rule.timeZone)}</li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">没有后续执行时间</p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
