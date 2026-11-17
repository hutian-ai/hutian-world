"use client";
import { api } from "@/lib/api";
import type { Page } from "@hutian-world/contracts";
import Link, { useRouter, useSearchParams } from "@/lib/navigation";
import {
  loadSchedule,
  loadScheduledRun,
  loadSchedules,
} from "@/lib/schedule-actions";
import {
  scheduleAt,
  scheduledWorkHref,
  scheduleHref,
  scheduleStateLabels,
  scheduleStatusLabels,
  scheduleSummary,
} from "@/lib/schedule-display";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { Badge } from "@hutian-ai/design/ui/badge";
import { Button } from "@hutian-ai/design/ui/button";
import { Input } from "@hutian-ai/design/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hutian-ai/design/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@hutian-ai/design/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@hutian-ai/design/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@hutian-ai/design/ui/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@hutian-ai/design/ui/toggle-group";
import type { ScheduledRun, ScheduledTask } from "@hutian-world/contracts";
import { CalendarDays, List, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScheduleActions } from "./schedule-actions";
import { ScheduleCalendar } from "./schedule-calendar";
import { ScheduleDayPreview } from "./schedule-day-preview";
import { ScheduleRunResult, ScheduleRuns } from "./schedule-runs";
import { ScheduleSummary } from "./schedule-summary";

type Props = {
  initial: {
    tasks: ScheduledTask[];
    runs: ScheduledRun[];
    nextCursor?: string | null;
  };
  roles: { id: string; name: string }[];
};
export function SchedulesWorkspace({ initial, roles }: Props) {
  const navigate = useNavigate();
  const params = useSearchParams(),
    router = useRouter();
  const [data, setData] = useState(initial),
    [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false),
    [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(params.get("query") ?? "");
  const [peek, setPeek] = useState<Awaited<
      ReturnType<typeof loadSchedule>
    > | null>(null),
    [peekRetry, setPeekRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  async function loadMore() {
    if (!data.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api<Page<ScheduledRun>>(
        `/v2/scheduled-runs?cursor=${encodeURIComponent(data.nextCursor)}`,
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
  const [externalRun, setExternalRun] = useState<ScheduledRun | null>(null);
  const peekTaskId = useRef<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null),
    region = useRef<HTMLDivElement>(null);
  const selected = params.get("selected"),
    runId = params.get("run");
  const dayParam = params.get("day");
  const selectedDay =
    dayParam &&
    /^\d{4}-\d{2}-\d{2}$/.test(dayParam) &&
    Number.isFinite(Date.parse(`${dayParam}T00:00:00+08:00`))
      ? dayParam
      : null;
  const tab = params.get("tab") === "runs" ? "runs" : "schedules";
  const display = params.get("view") === "list" ? "list" : "calendar";
  const query = params.get("query") ?? "",
    roleId = params.get("role") ?? "";
  const status = ["active", "paused", "ended"].includes(
    params.get("status") ?? "",
  )
    ? (params.get("status") as "active" | "paused" | "ended")
    : "all";
  const group = params.get("group") ?? "none";
  const returnTo = `/schedules${params.size ? `?${params}` : ""}`;
  const update = useCallback(
    (values: Record<string, string | null>, replace = false) => {
      const url = new URL(window.location.href);
      for (const [key, value] of Object.entries(values)) {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
      }
      void navigate(url.pathname + url.search, {
        replace,
        preventScrollReset: true,
      });
    },
    [navigate],
  );
  const refresh = useCallback(async () => {
    const result = await loadSchedules();
    if (result.ok) {
      setData((old) => ({
        tasks: result.tasks,
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
      setRevision((value) => value + 1);
    } else setError(result.error);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    setSearch(query);
  }, [query]);
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(
      () => update({ query: search || null }, true),
      300,
    );
    return () => clearTimeout(timer);
  }, [search, query, update]);
  useEffect(() => {
    if (peekTaskId.current !== selected) {
      setPeek(null);
      peekTaskId.current = selected;
    }
    if (!selected) return;
    let current = true;
    void loadSchedule(selected).then((result) => {
      if (current) setPeek(result);
    });
    return () => {
      current = false;
    };
  }, [selected, revision, peekRetry]);
  useEffect(() => {
    if (!runId || data.runs.some((run) => run.id === runId)) return;
    let current = true;
    void loadScheduledRun(runId).then((value) => {
      if (current) {
        if (value.ok) setExternalRun(value.run);
        else setError(value.error);
      }
    });
    return () => {
      current = false;
    };
  }, [runId, revision, data.runs]);
  const openTask = (id: string, element: HTMLElement, day?: string) => {
    returnFocus.current = element;
    update({ selected: id, run: null, day: day ?? null });
  };
  const selectRun = (run: ScheduledRun) => {
    navigate(scheduledWorkHref(run.id, returnTo));
  };
  const roleName = (id: string) =>
    roles.find((role) => role.id === id)?.name ?? "成员暂不可用";
  const filtered = data.tasks
    .filter(
      (task) =>
        (!query ||
          task.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
        (!roleId || roleId === task.roleId) &&
        (status === "all" || task.status === status),
    )
    .sort(
      (a, b) =>
        (a.nextStartAt ?? "z").localeCompare(b.nextStartAt ?? "z") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const runs = data.runs.filter(
    (run) =>
      (!query ||
        run.snapshot.title
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())) &&
      (!roleId || run.snapshot.roleId === roleId),
  );
  const groups = new Map<string, ScheduledTask[]>();
  for (const task of filtered) {
    const label =
      group === "status"
        ? scheduleStatusLabels[task.status]
        : group === "role"
          ? roleName(task.roleId)
          : "";
    groups.set(label, [...(groups.get(label) ?? []), task]);
  }
  const selectedRun =
    data.runs.find((run) => run.id === runId) ??
    (externalRun?.id === runId ? externalRun : null);
  return (
    <div ref={region} tabIndex={-1} className="space-y-5 outline-none">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">定时任务</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="刷新定时任务"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              try {
                await refresh();
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
          </Button>
          <Button asChild size="sm">
            <Link href={`/schedules/new?${new URLSearchParams({ returnTo })}`}>
              <Plus />
              新建任务
            </Link>
          </Button>
        </div>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error} 当前列表可能不是最新状态。
          </AlertDescription>
        </Alert>
      )}
      <Tabs
        value={tab}
        onValueChange={(value) =>
          update({
            tab: value === "runs" ? "runs" : null,
            selected: null,
            run: null,
          })
        }
      >
        <TabsList variant="line">
          <TabsTrigger value="schedules">任务安排</TabsTrigger>
          <TabsTrigger value="runs">运行记录</TabsTrigger>
        </TabsList>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {tab === "schedules" && (
            <ToggleGroup
              type="single"
              value={display}
              variant="outline"
              size="sm"
              onValueChange={(value) => {
                if (value) update({ view: value });
              }}
              aria-label="任务展示方式"
            >
              <ToggleGroupItem value="calendar" aria-label="日历视图">
                <CalendarDays />
                日历
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="列表视图">
                <List />
                列表
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <div className="relative min-w-44 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              aria-label="搜索定时任务"
              placeholder="搜索任务…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            value={roleId || "all"}
            onValueChange={(value) =>
              update({ role: value === "all" ? null : value })
            }
          >
            <SelectTrigger className="w-48" aria-label="按成员筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部成员</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tab === "schedules" && (
            <>
              <Select
                value={status}
                onValueChange={(value) =>
                  update({ status: value === "all" ? null : value })
                }
              >
                <SelectTrigger className="w-32" aria-label="按状态筛选">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">已启用</SelectItem>
                  <SelectItem value="paused">已暂停</SelectItem>
                  <SelectItem value="ended">已结束</SelectItem>
                </SelectContent>
              </Select>
              {display === "list" && (
                <Select
                  value={group}
                  onValueChange={(value) =>
                    update({ group: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger className="w-32" aria-label="列表分组">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不分组</SelectItem>
                    <SelectItem value="status">按状态分组</SelectItem>
                    <SelectItem value="role">按成员分组</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </>
          )}
          {(query || roleId || (tab === "schedules" && status !== "all")) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                update({ query: null, role: null, status: null });
              }}
            >
              清除筛选
            </Button>
          )}
        </div>
        <TabsContent value="schedules" className="mt-4 space-y-4">
          {display === "calendar" ? (
            <ScheduleCalendar
              view={
                params.get("calendarView") ??
                (window.matchMedia("(max-width: 820px)").matches
                  ? "agenda"
                  : "week")
              }
              date={params.get("date") ?? ""}
              query={query}
              roleId={roleId}
              status={status}
              revision={revision}
              onCreate={(date) =>
                router.push(
                  `/schedules/new?${new URLSearchParams({ date, returnTo: window.location.pathname + window.location.search })}`,
                )
              }
              onSelect={(item, element, day) => {
                if (item.runId && !day) {
                  returnFocus.current = element;
                  navigate(scheduledWorkHref(item.runId, returnTo));
                } else openTask(item.scheduleId, element, day);
              }}
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {filtered.length} 个任务
                {data.tasks.length === 100 ? " · 当前显示前 100 个" : ""}
              </p>
              {[...groups].map(([label, tasks]) => (
                <section key={label} className="space-y-2">
                  {label && (
                    <h2 className="text-xs font-medium text-muted-foreground">
                      {label} <span className="ml-1">{tasks.length}</span>
                    </h2>
                  )}
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>任务</TableHead>
                          <TableHead>执行成员与交付</TableHead>
                          <TableHead>下次运行</TableHead>
                          <TableHead>最近运行</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead className="w-12">
                            <span className="sr-only">操作</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => {
                          const latest = data.runs.find(
                            (run) => run.scheduleId === task.id,
                          );
                          return (
                            <TableRow key={task.id}>
                              <TableCell className="min-w-64 max-w-96">
                                <button
                                  className="text-left text-sm font-medium hover:underline"
                                  onClick={(event) =>
                                    openTask(task.id, event.currentTarget)
                                  }
                                >
                                  {task.title}
                                </button>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {scheduleSummary(task.rule)}
                                </p>
                              </TableCell>
                              <TableCell className="max-w-52">
                                <p className="truncate">
                                  {roleName(task.roleId)}
                                </p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  结果进入收件箱
                                </p>
                              </TableCell>
                              <TableCell className="min-w-40 text-xs">
                                {task.enabled
                                  ? scheduleAt(
                                      task.nextStartAt,
                                      task.rule.timeZone,
                                    )
                                  : task.status === "ended"
                                    ? "没有后续时间"
                                    : "已暂停"}
                                <p className="mt-1 text-muted-foreground">
                                  {task.rule.timeZone}
                                </p>
                              </TableCell>
                              <TableCell className="text-xs">
                                {latest ? (
                                  <button
                                    className="text-left hover:underline"
                                    onClick={() => selectRun(latest)}
                                  >
                                    {scheduleStateLabels[latest.state]}
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground">
                                    尚未运行
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  <span
                                    className={`mr-1.5 inline-block size-1.5 rounded-full ${task.enabled ? "bg-primary" : "bg-muted-foreground"}`}
                                  />
                                  {scheduleStatusLabels[task.status]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <ScheduleActions
                                  task={task}
                                  returnTo={returnTo}
                                  compact
                                  onChanged={refresh}
                                  onPreview={(element) =>
                                    openTask(task.id, element)
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              ))}
              {!filtered.length && (
                <div className="rounded-md border py-16 text-center">
                  <h2 className="text-sm font-medium">
                    {data.tasks.length ? "没有匹配的任务" : "还没有定时任务"}
                  </h2>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.tasks.length
                      ? "试试其他关键词或清除筛选。"
                      : "选择成员、工作要求和时间，创建第一个安排。"}
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="runs" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            最近 {runs.length} 条记录
          </p>
          <ScheduleRuns runs={runs} select={selectRun} />
          {data.nextCursor && (
            <Button
              variant="outline"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "正在读取…" : "读取较早运行"}
            </Button>
          )}
        </TabsContent>
      </Tabs>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) update({ selected: null, day: null });
        }}
      >
        <SheetContent
          className="w-full gap-0 sm:max-w-xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (returnFocus.current?.isConnected
              ? returnFocus.current
              : region.current
            )?.focus();
          }}
        >
          <SheetHeader className="shrink-0 border-b p-6 pr-12">
            <SheetTitle>{peek?.ok ? peek.task.title : "任务详情"}</SheetTitle>
            <SheetDescription className="sr-only">
              任务设置与运行记录
            </SheetDescription>
          </SheetHeader>
          <div
            className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6"
            tabIndex={0}
            aria-label="任务详情正文"
          >
            {!peek ? (
              <p role="status" className="text-sm text-muted-foreground">
                正在读取任务…
              </p>
            ) : !peek.ok ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {peek.error}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setPeekRetry((value) => value + 1)}
                  >
                    重试
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {selectedDay && (
                  <ScheduleDayPreview
                    key={`${peek.task.id}:${selectedDay}`}
                    scheduleId={peek.task.id}
                    day={selectedDay}
                    revision={revision}
                    onRun={(id) => navigate(scheduledWorkHref(id, returnTo))}
                  />
                )}
                <ScheduleSummary
                  task={peek.task}
                  roleName={roleName(peek.task.roleId)}
                />
                {peek.runs.length > 0 && (
                  <section className="space-y-3 border-t pt-5">
                    <h2 className="text-sm font-semibold">最近运行</h2>
                    <ScheduleRuns
                      compact
                      runs={peek.runs.slice(0, 3)}
                      select={selectRun}
                    />
                  </section>
                )}
              </>
            )}
          </div>
          {peek?.ok && (
            <SheetFooter className="shrink-0 flex-row items-center justify-between border-t">
              <Button asChild variant="ghost" size="sm">
                <Link href={scheduleHref(peek.task.id, returnTo)}>
                  完整详情
                </Link>
              </Button>
              <ScheduleActions
                task={peek.task}
                returnTo={returnTo}
                compact={false}
                onChanged={async () => {
                  update({ selected: null });
                  await refresh();
                }}
              />
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
      <ScheduleRunResult
        run={selectedRun}
        onClose={() => update({ run: null })}
        returnFocus={returnFocus}
      />
    </div>
  );
}
