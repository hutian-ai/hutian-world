"use client";
import { useEffect, useState } from "react";
import { loadScheduleCalendar } from "@/lib/schedule-actions";
import { scheduleStateLabels } from "@/lib/schedule-display";
import { Button } from "@hutian-ai/design/ui/button";
import { Badge } from "@hutian-ai/design/ui/badge";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";

export function ScheduleDayPreview({
  scheduleId,
  day,
  revision,
  onRun,
}: {
  scheduleId: string;
  day: string;
  revision: number;
  onRun: (id: string) => void;
}) {
  const [response, setResponse] = useState<Awaited<
    ReturnType<typeof loadScheduleCalendar>
  > | null>(null);
  useEffect(() => {
    let current = true;
    const from = new Date(`${day}T00:00:00+08:00`).toISOString(),
      to = new Date(Date.parse(from) + 86400000).toISOString();
    void loadScheduleCalendar({ from, to, scheduleId }).then((value) => {
      if (current) setResponse(value);
    });
    return () => {
      current = false;
    };
  }, [day, scheduleId, revision]);
  return (
    <section
      className="space-y-3 border-b pb-5"
      aria-label="所选日期的触发时间"
    >
      <h2 className="text-sm font-semibold">{day} 的安排</h2>
      {!response ? (
        <p role="status" className="text-xs text-muted-foreground">
          正在读取当天时间…
        </p>
      ) : !response.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{response.error}</AlertDescription>
        </Alert>
      ) : response.items.length ? (
        <>
          <ul className="divide-y rounded-md border px-3">
            {response.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <time dateTime={item.at} className="tabular-nums">
                  {new Intl.DateTimeFormat("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(new Date(item.at))}
                </time>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {item.kind === "expected"
                      ? "预计触发"
                      : scheduleStateLabels[item.state!]}
                  </Badge>
                  {item.runId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRun(item.runId!)}
                    >
                      查看记录
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          当天暂无已生成的运行或未来触发时间。
        </p>
      )}
    </section>
  );
}
