"use client";
import Link from "@/lib/navigation";
import type { ScheduledTask } from "@hutian-world/contracts";
import {
  scheduleAt,
  scheduleStatusLabels,
  scheduleSummary,
} from "@/lib/schedule-display";
import { Badge } from "@hutian-ai/design/ui/badge";
import { OrganizationMarkdown } from "./organization-markdown";

export function ScheduleSummary({
  task,
  roleName,
}: {
  task: ScheduledTask;
  roleName: string;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">运行安排</h2>
          <Badge variant="outline">{scheduleStatusLabels[task.status]}</Badge>
        </div>
        <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">下次运行</dt>
          <dd>
            {task.enabled
              ? scheduleAt(task.nextStartAt, task.rule.timeZone)
              : task.status === "paused"
                ? "已暂停"
                : "没有后续执行"}
          </dd>
          <dt className="text-muted-foreground">重复规则</dt>
          <dd>{scheduleSummary(task.rule)}</dd>
          <dt className="text-muted-foreground">时区</dt>
          <dd>{task.rule.timeZone}</dd>
          <dt className="text-muted-foreground">执行成员</dt>
          <dd>{roleName}</dd>
          <dt className="text-muted-foreground">结果提醒</dt>
          <dd>
            <Link className="underline underline-offset-4" href="/inbox">
              收件箱
            </Link>
          </dd>
          <dt className="text-muted-foreground">执行配置</dt>
          <dd>
            <Link
              className="underline underline-offset-4"
              href={`/members/${task.roleId}?view=settings&section=runtime`}
            >
              跟随成员配置
            </Link>
          </dd>
        </dl>
      </section>
      <section className="space-y-3 border-t pt-5">
        <h2 className="text-sm font-semibold">工作要求</h2>
        <OrganizationMarkdown content={task.prompt} />
      </section>
      <details className="border-t pt-4 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          更多设置
        </summary>
        <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 text-xs">
          <dt className="text-muted-foreground">参考资源</dt>
          <dd>
            {[task.useKnowledge && "获授权知识", task.useMemory && "获授权记忆"]
              .filter(Boolean)
              .join("、") || "不额外读取知识和记忆"}
          </dd>
          <dt className="text-muted-foreground">启动窗口</dt>
          <dd>允许延后 {task.startWindowMinutes} 分钟</dd>
          <dt className="text-muted-foreground">等待上限</dt>
          <dd>{task.timeoutMinutes} 分钟</dd>
          <dt className="text-muted-foreground">无新结果</dt>
          <dd>
            {task.silentNoUpdate ? "保持安静，保留运行记录" : "正常交付回复"}
          </dd>
          <dt className="text-muted-foreground">结束日期</dt>
          <dd>{task.rule.endDate || "未设置"}</dd>
          {task.sourceAutomationId && (
            <>
              <dt className="text-muted-foreground">来源</dt>
              <dd>迁自 Codex 定时任务</dd>
            </>
          )}
        </dl>
      </details>
    </div>
  );
}
