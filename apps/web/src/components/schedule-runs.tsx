"use client";
import Link from "@/lib/navigation";
import { useEffect, useState } from "react";
import type { ScheduledRun } from "@hutian-world/contracts";
import { readScheduledResult } from "@/lib/schedule-actions";
import { scheduleAt, scheduleStateLabels } from "@/lib/schedule-display";
import { ScheduleRunStatus } from "./schedule-run-status";
import { OrganizationMarkdown } from "./organization-markdown";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@hutian-ai/design/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@hutian-ai/design/ui/sheet";

export function ScheduleRuns({
  runs,
  select,
  compact = false,
  roles,
}: {
  runs: ScheduledRun[];
  select: (run: ScheduledRun, element: HTMLElement) => void;
  compact?: boolean;
  roles?: { id: string; name: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {!compact && <TableHead>任务</TableHead>}
            <TableHead>计划时间</TableHead>
            {roles && <TableHead>当次成员</TableHead>}
            <TableHead>状态</TableHead>
            <TableHead className="text-right">结果</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              {!compact && (
                <TableCell className="max-w-72">
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={(event) => select(run, event.currentTarget)}
                  >
                    {run.snapshot.title}
                  </button>
                </TableCell>
              )}
              <TableCell className="text-xs">
                {scheduleAt(run.scheduledAt, run.snapshot.rule.timeZone)}
                <p className="mt-1 text-muted-foreground">
                  {run.manual ? "手动运行" : "定时触发"}
                </p>
              </TableCell>
              {roles && (
                <TableCell className="text-xs">
                  {roles.find((role) => role.id === run.snapshot.roleId)
                    ?.name ?? "成员暂不可用"}
                </TableCell>
              )}
              <TableCell>
                <ScheduleRunStatus state={run.state} />
                {run.error && (
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    {run.error}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => select(run, event.currentTarget)}
                >
                  {run.replyEventId ? "查看结果" : "查看记录"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!runs.length && (
            <TableRow>
              <TableCell
                colSpan={(compact ? 3 : 4) + (roles ? 1 : 0)}
                className="py-12 text-center text-muted-foreground"
              >
                还没有运行记录。任务会在计划时间触发，也可选择立即运行。
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function ScheduleRunResult({
  run,
  onClose,
  returnFocus,
}: {
  run: ScheduledRun | null;
  onClose: () => void;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof readScheduledResult>
  > | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setResult(null);
    if (!run?.replyEventId) return;
    let current = true;
    void readScheduledResult(run.id).then((value) => {
      if (current) setResult(value);
    });
    return () => {
      current = false;
    };
  }, [run?.id, run?.replyEventId, retry]);
  return (
    <Sheet
      open={Boolean(run)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="w-full gap-0 sm:max-w-3xl"
        onCloseAutoFocus={(event) => {
          if (returnFocus?.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <SheetHeader className="shrink-0 border-b p-6 pr-12">
          <SheetTitle>{run?.snapshot.title ?? "运行记录"}</SheetTitle>
          <SheetDescription>
            {run
              ? `${scheduleAt(run.scheduledAt, run.snapshot.rule.timeZone)} · ${scheduleStateLabels[run.state]}`
              : ""}
          </SheetDescription>
        </SheetHeader>
        <div
          className="min-h-0 flex-1 overflow-y-auto p-6"
          tabIndex={0}
          aria-label="运行结果正文"
        >
          {run?.error && (
            <Alert
              variant={run.state === "failed" ? "destructive" : "default"}
              className="mb-4"
            >
              <AlertDescription>{run.error}</AlertDescription>
            </Alert>
          )}
          {!run?.replyEventId ? (
            <p className="text-sm text-muted-foreground">
              {run?.state === "skipped"
                ? "本次无需新结果。"
                : run?.state === "failed"
                  ? "本次执行已结束，未交付完整结果。可打开原会话查看过程，排查后重新执行。"
                  : run?.state === "waiting_permission"
                    ? "任务正在等待你的决定。请打开本次工作，查看请求详情并选择本次允许或拒绝。"
                    : "尚未交付回复。"}
            </p>
          ) : !result ? (
            <p role="status" className="text-sm text-muted-foreground">
              正在读取原消息…
            </p>
          ) : !result.ok ? (
            <Alert variant="destructive">
              <AlertDescription>
                {result.error}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-3"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {result.outputsState === "unconfirmed" && (
                <Alert>
                  <AlertDescription>
                    回复已交付，原生成果文件尚未取回。下方已有的报告附件仍可打开，也可前往本次工作补取原成果。
                  </AlertDescription>
                </Alert>
              )}
              {Boolean(result.attachments.length) && (
                <div className="flex flex-wrap gap-2">
                  {[
                    ...new Map(
                      result.attachments.map((file) => [file.name, file]),
                    ).values(),
                  ].map((file) => (
                    <Button
                      asChild
                      key={file.sourcePath}
                      variant="outline"
                      size="sm"
                    >
                      <a href={file.href} target="_blank" rel="noreferrer">
                        打开附件 · {file.name}
                      </a>
                    </Button>
                  ))}
                </div>
              )}
              <OrganizationMarkdown
                content={result.message.text.replace(
                  /\[([^\]]+)\]\(([^)]+)\)/g,
                  (link, label: string, target: string) => {
                    let path = target;
                    try {
                      path = decodeURIComponent(target);
                    } catch {
                      /* Keep the original target. */
                    }
                    const file = result.attachments.find(
                      (item) => item.sourcePath === path,
                    );
                    if (file) return `[${label}](${file.href})`;
                    return /^(?:file:\/\/|\/(?:Users|home|tmp|private|Volumes|var)\/|[a-z]:[\\/])/i.test(
                      path,
                    )
                      ? label
                      : link;
                  },
                )}
              />
            </div>
          )}
        </div>
        {run?.eventId && (
          <div className="shrink-0 border-t p-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/inbox?run=${run.id}`}>
                {run.state === "waiting_permission" ? "去授权" : "打开本次工作"}
              </Link>
            </Button>
            {run.state === "failed" && (
              <Button asChild variant="outline" size="sm" className="ml-2">
                <Link href={`/schedules/${run.scheduleId}`}>
                  查看任务与重新执行
                </Link>
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
