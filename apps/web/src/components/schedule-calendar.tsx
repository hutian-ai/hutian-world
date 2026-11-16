"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DatesSetInfo, EventInput } from "@fullcalendar/react";
import zhCnLocale from "@fullcalendar/react/locales/zh-cn";
import type { ScheduleCalendarItem } from "@hutian-world/contracts";
import { loadScheduleCalendar } from "@/lib/schedule-actions";
import { scheduleStateLabels } from "@/lib/schedule-display";
import { EventCalendar } from "./event-calendar";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { Button } from "@hutian-ai/design/ui/button";

type DayGroup = {
  id: string;
  day: string;
  title: string;
  at: string;
  items: ScheduleCalendarItem[];
  color: string;
};
const views: Record<string, string> = {
  week: "dayGridWeek",
  month: "dayGridMonth",
  agenda: "listWeek",
};
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
export function ScheduleCalendar({
  view,
  date,
  query,
  roleId,
  status,
  revision,
  onSelect,
  onCreate,
}: {
  view: string;
  date: string;
  query: string;
  roleId: string;
  status: "all" | "active" | "paused" | "ended";
  revision: number;
  onSelect: (
    item: ScheduleCalendarItem,
    element: HTMLElement,
    day?: string,
  ) => void;
  onCreate: (date: string) => void;
}) {
  const navigate = useNavigate();
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [response, setResponse] = useState<{
    key: string;
    items: ScheduleCalendarItem[];
    error: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [position, setPosition] = useState<{
    view: string;
    date: string;
    source: string;
  } | null>(null);
  const datesSet = useCallback(
    (info: DatesSetInfo) => {
      const next = {
        from: info.start.toISOString(),
        to: info.end.toISOString(),
      };
      setRange((previous) =>
        previous?.from === next.from && previous.to === next.to
          ? previous
          : next,
      );
      setPosition({
        view:
          Object.keys(views).find((key) => views[key] === info.view.type) ??
          "week",
        date: dayFormat.format(info.view.calendar.getDate()),
        source: `${view}:${date}`,
      });
    },
    [view, date],
  );
  useEffect(() => {
    if (!position || position.source !== `${view}:${date}`) return;
    const current = new URL(window.location.href);
    current.searchParams.set("calendarView", position.view);
    current.searchParams.set("date", position.date);
    current.searchParams.delete("future"); // Old links now use the complete, compact calendar.
    current.searchParams.delete("density");
    if (current.href !== window.location.href)
      void navigate(current.pathname + current.search, {
        replace: true,
        preventScrollReset: true,
      });
  }, [position, navigate, view, date]);
  const key = range ? JSON.stringify({ ...range, query, roleId, status }) : "";
  useEffect(() => {
    if (!key) return;
    let current = true;
    void loadScheduleCalendar(JSON.parse(key)).then((value) => {
      if (current)
        setResponse({
          key,
          items: value.ok ? value.items : [],
          error: value.ok ? "" : value.error,
        });
    });
    return () => {
      current = false;
    };
  }, [key, revision, retry]);
  const current = response?.key === key ? response : null;
  const items = current?.items ?? [];
  const groups = useMemo(() => {
    const grouped = new Map<string, DayGroup>();
    for (const item of items) {
      const day = dayFormat.format(new Date(item.at));
      const id = `${item.scheduleId}:${day}`;
      const existing = grouped.get(id);
      if (existing) existing.items.push(item);
      else
        grouped.set(id, {
          id,
          day,
          at: item.at,
          title: item.title,
          items: [item],
          color: "var(--muted-foreground)",
        });
    }
    for (const group of grouped.values()) {
      const states = group.items.map((item) => item.state);
      group.color =
        states.includes("failed") || states.includes("missed")
          ? "var(--destructive)"
          : states.includes("blocked") ||
              states.includes("unknown") ||
              states.includes("waiting_permission")
            ? "var(--warning, #f2c94c)"
            : group.items.some((item) => item.kind === "run")
              ? "var(--primary)"
              : "var(--muted-foreground)";
    }
    return [...grouped.values()];
  }, [items]);
  const events: EventInput[] = useMemo(
    () =>
      groups.map((group) => ({
        id: group.id,
        title: `${group.title}${group.items.length > 1 ? ` · ${group.items.length} 次触发` : ""}`,
        start: group.at,
        allDay: false,
        color: group.color,
        extendedProps: { calendarGroup: group },
      })),
    [groups],
  );
  const taskCount = new Set(items.map((item) => item.scheduleId)).size;
  const expectedCount = items.filter((item) => item.kind === "expected").length;
  const runCount = items.length - expectedCount;
  return (
    <section aria-label="定时任务日历" className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span role="status">
            {current?.error
              ? "日历读取失败"
              : current
                ? `${taskCount} 个任务${expectedCount ? ` · ${expectedCount} 次预计触发` : ""}${runCount ? ` · ${runCount} 次运行` : ""}`
                : "正在读取日历…"}
          </span>
        </div>
      </div>
      {current?.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {current.error}
            <Button
              size="sm"
              variant="outline"
              className="ml-3"
              onClick={() => setRetry((value) => value + 1)}
            >
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <EventCalendar
        scrollGrid={view !== "agenda"}
        key={`${view}:${date}`}
        initialView={views[view] ?? views.week}
        initialDate={date || undefined}
        locale={zhCnLocale}
        timeZone="Asia/Shanghai"
        firstDay={1}
        height="auto"
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        displayEventEnd={false}
        listDayClass="flex flex-col border-b sm:flex-row sm:items-start"
        listDayHeaderClass={(info) =>
          `shrink-0 px-3 py-3 sm:w-36 ${info.isToday ? "border-l-2 border-primary" : ""}`
        }
        listDayBodyClass="min-w-0 grow gap-1 p-2"
        views={{
          list: {
            listItemEventClass:
              "border-l-2 border-(--fc-event-color) rounded-sm bg-background px-2 py-1 hover:bg-accent/50",
          },
          dayGrid: {
            listItemEventClass: "mx-1 my-0.5 rounded hover:bg-accent",
            listItemEventInnerClass: "flex min-w-0 w-full items-center",
            listItemEventBeforeClass: "hidden",
          },
          dayGridWeek: {
            aspectRatio: 3.5,
            dayMaxEvents: 3,
            titleFormat: { year: "numeric", month: "numeric", day: "numeric" },
          },
          dayGridMonth: { dayMaxEvents: 3 },
          listWeek: {
            titleFormat: { year: "numeric", month: "numeric", day: "numeric" },
            listItemEventBeforeClass: "hidden",
            listItemEventInnerClass: "flex w-full min-w-0",
          },
        }}
        eventContent={(info) => {
          const group = info.event.extendedProps.calendarGroup as DayGroup;
          const count = group.items.length;
          const label =
            count > 1
              ? `${count} 次触发`
              : group.items[0]!.kind === "run"
                ? scheduleStateLabels[group.items[0]!.state!]
                : "";
          return (
            <div
              className="flex w-full min-w-0 items-start gap-1.5 px-1 py-1 text-xs"
              title={`${group.title}\n${group.items.map((item) => `${timeFormat.format(new Date(item.at))} ${item.kind === "expected" ? "预计触发" : scheduleStateLabels[item.state!]}`).join("\n")}`}
            >
              <span
                className="mt-1 size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <time className="tabular-nums">
                    {timeFormat.format(new Date(group.at))}
                  </time>
                  {label && <span className="ml-auto truncate">{label}</span>}
                </div>
                <p
                  className={`mt-0.5 leading-5 ${view === "agenda" ? "whitespace-normal break-words" : "truncate"}`}
                >
                  {group.title}
                </p>
              </div>
            </div>
          );
        }}
        editable={false}
        selectable={false}
        navLinks={false}
        moreLinkClick="popover"
        events={events}
        datesSet={datesSet}
        dateClick={(info) => onCreate(info.dateStr.slice(0, 10))}
        eventClick={(info) => {
          const group = info.event.extendedProps.calendarGroup as DayGroup;
          onSelect(
            group.items[0]!,
            info.el,
            group.items.length > 1 || group.items[0]!.kind === "expected"
              ? group.day
              : undefined,
          );
        }}
        noEventsText={
          current?.error
            ? "日历暂不可用"
            : current
              ? "这个时间范围没有安排"
              : "正在读取安排…"
        }
      />
    </section>
  );
}
