"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/lib/navigation";
import type { ScheduledRun, ScheduledTask } from "@hutian-world/contracts";
import { loadSchedule, previewScheduleRule } from "@/lib/schedule-actions";
import {
  scheduleAt,
  scheduleHref,
  scheduledWorkHref,
  scheduleStatusLabels,
} from "@/lib/schedule-display";
import { ScheduleActions } from "./schedule-actions";
import { ScheduleSummary } from "./schedule-summary";
import { ScheduleRuns } from "./schedule-runs";
import { Badge } from "@hutian-ai/design/ui/badge";
import { PageNavigation } from "./page-navigation";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";

export function ScheduleDetail({
  initial,
  roleName,
  roles,
  returnTo,
}: {
  initial: { task: ScheduledTask; runs: ScheduledRun[] };
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
      setData({ task: result.task, runs: result.runs });
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
