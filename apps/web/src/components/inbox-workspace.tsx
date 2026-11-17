import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Link, { useSearchParams } from "@/lib/navigation";
import {
  ArrowLeft,
  CalendarClock,
  RefreshCw,
  Check,
  MoreHorizontal,
  Mail,
  MailOpen,
} from "lucide-react";
import type {
  Role,
  ScheduledInbox,
  ScheduledRun,
  ScheduledRunNotice,
  ScheduledNoticeChange,
} from "@hutian-world/contracts";
import { loadInbox, loadInboxNotice, markInbox, undoInbox } from "@/lib/inbox";
import { loadScheduledRun, runSchedule } from "@/lib/schedule-actions";
import { readConversation, type Conversation } from "@/lib/communications";
import {
  scheduleAt,
  scheduleStateLabels,
  scheduleHref,
  scheduledWorkHref,
  scheduledWorkReturnTo,
  scheduleReturnTo,
} from "@/lib/schedule-display";
import { ScheduleRunStatus, scheduleRunTone } from "./schedule-run-status";
import { Communications } from "./communications";
import { Button } from "@hutian-ai/design/ui/button";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";

import { Checkbox } from "@hutian-ai/design/ui/checkbox";
import { SelectionBar } from "@hutian-ai/design/ui/selection-bar";
import { Item, ItemActions } from "@hutian-ai/design/ui/item";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hutian-ai/design/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@hutian-ai/design/ui/dropdown-menu";
import { toast } from "sonner";

type MarkAction = "read" | "unread" | "done";
const canResolve = (item: ScheduledRunNotice) =>
  ["failed", "missed"].includes(item.run.state) && !item.resolvedAt;
const needsMark = (item: ScheduledRunNotice, action: MarkAction) =>
  action === "done"
    ? canResolve(item)
    : action === "read"
      ? !item.readAt
      : Boolean(item.readAt);

function WorkConversation({
  run,
  roles,
}: {
  run: ScheduledRun;
  roles: Role[];
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!run.snapshot.roomId) return;
    let current = true;
    void readConversation(run.snapshot.roomId)
      .then((value) => {
        if (current) {
          setConversation(value);
          setError("");
        }
      })
      .catch((reason) => {
        if (current)
          setError(
            reason instanceof Error ? reason.message : "本次工作暂不可读取。",
          );
      });
    return () => {
      current = false;
    };
  }, [run.snapshot.roomId, retry]);
  if (error)
    return (
      <Alert variant="destructive" className="m-4 w-auto">
        <AlertDescription>
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRetry((x) => x + 1)}
          >
            重新读取
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!run.snapshot.roomId)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {["failed", "missed"].includes(run.state)
          ? "本次未启动执行，原因已记录。"
          : "正在准备本次工作对话…"}
      </div>
    );
  if (!conversation)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        正在读取本次工作…
      </p>
    );
  return (
    <Communications
      embedded
      initial={conversation}
      selectedId={run.snapshot.roomId}
      preferredAgentId={
        conversation.agents.find((a) => a.roleId === run.snapshot.roleId)?.id
      }
      directory={{
        rooms: [{ ...conversation.room, kind: "direct" }],
        agents: conversation.agents,
        roles,
      }}
    />
  );
}

export function InboxWorkspace({ roles }: { roles: Role[] }) {
  const navigate = useNavigate(),
    params = useSearchParams();
  const selectedId = params.get("run");
  const filterParam = params.get("filter");
  const filter =
    filterParam === "unread" || filterParam === "attention"
      ? filterParam
      : "all";
  const returnTo = scheduledWorkReturnTo(params.get("returnTo"));
  const [data, setData] = useState<ScheduledInbox | null>(null);
  const [run, setRun] = useState<ScheduledRun | null>(null);
  const [notice, setNotice] = useState<ScheduledRunNotice | null>(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [runError, setRunError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Map<string, ScheduledRunNotice>>(
    new Map(),
  );
  const [operationError, setOperationError] = useState("");
  const [feedback, setFeedback] = useState("");
  const actionLock = useRef(false);
  const currentId = useRef(selectedId);
  currentId.current = selectedId;
  const reading = useRef<Promise<unknown>>(Promise.resolve());
  const undoToast = useRef<string | number | undefined>(undefined);
  const refreshLatest = useRef<() => Promise<unknown>>(async () => {});
  const readKey = useRef("");
  const refreshVersion = useRef(0);
  const detailVersion = useRef(0);
  const retryRequest = useRef<{ scheduleId: string; id: string } | null>(null);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    setRefreshing(true);
    try {
      const incoming = await loadInbox(filter);
      if (version !== refreshVersion.current) return;
      setData(incoming);
      setChecked(
        (previous) =>
          new Map(
            incoming.notices
              .filter((item) => previous.has(item.id))
              .map((item) => [item.id, item]),
          ),
      );
      setListError("");
    } catch (reason) {
      if (version !== refreshVersion.current) return;
      setListError(
        reason instanceof Error ? reason.message : "收件箱暂不可读取。",
      );
    } finally {
      if (version === refreshVersion.current) setRefreshing(false);
    }
  }, [filter]);
  const refreshDetail = useCallback(async () => {
    if (!selectedId) return;
    const version = ++detailVersion.current;
    try {
      const [result, incomingNotice] = await Promise.all([
        loadScheduledRun(selectedId),
        loadInboxNotice(selectedId),
      ]);
      if (version !== detailVersion.current) return;
      if (!result.ok) {
        setRunError(result.error);
        return;
      }
      setRun((previous) =>
        previous?.id === result.run.id &&
        previous.updatedAt > result.run.updatedAt
          ? previous
          : result.run,
      );
      setNotice(incomingNotice);
      setRunError("");
    } catch (reason) {
      if (version === detailVersion.current)
        setRunError(
          reason instanceof Error ? reason.message : "本次工作暂不可读取。",
        );
    }
  }, [selectedId]);
  useEffect(() => {
    refreshLatest.current = () => Promise.all([refresh(), refreshDetail()]);
  }, [refresh, refreshDetail]);
  useEffect(
    () => () => {
      if (undoToast.current !== undefined) toast.dismiss(undoToast.current);
    },
    [],
  );
  useEffect(() => {
    setChecked(new Map());
    setData(null);
    setFeedback("");
    setOperationError("");
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    setRun(null);
    setNotice(null);
    setRunError("");
    setError("");
    readKey.current = "";
    void refreshDetail();
    const timer = setInterval(() => void refreshDetail(), 5000);
    return () => {
      detailVersion.current++;
      clearInterval(timer);
    };
  }, [refreshDetail]);
  useEffect(() => {
    if (busy || !notice || notice.id !== selectedId || notice.readAt) return;
    const key = `${notice.id}:${notice.updatedAt}`;
    if (readKey.current === key) return;
    readKey.current = key;
    reading.current = markInbox(notice.id, "read", notice.updatedAt)
      .then(() => Promise.all([refresh(), refreshDetail()]))
      .catch(() => {
        readKey.current = "";
        setError("已读状态未保存，请重新打开这条通知。");
      });
  }, [busy, notice, selectedId, refresh, refreshDetail]);
  async function restore(changes: ScheduledNoticeChange[]) {
    if (actionLock.current) {
      toast.info("请等待当前操作完成后再撤销。");
      return;
    }
    actionLock.current = true;
    setBusy(true);
    setOperationError("");
    await reading.current;
    let restored = 0;
    const failed: ScheduledNoticeChange[] = [];
    for (const change of changes) {
      if (change.field === "readAt" && change.id === currentId.current)
        readKey.current = `${change.id}:${change.updatedAt}`;
      try {
        await undoInbox(change);
        restored++;
      } catch {
        failed.push(change);
      }
    }
    setFeedback(
      `已撤销 ${restored} 项${failed.length ? `，${failed.length} 项未撤销` : ""}。`,
    );
    if (failed.length)
      setOperationError(
        "部分通知已有变化或撤销结果未确认，请刷新核对；已保存的后续状态不会被覆盖。",
      );
    await refreshLatest.current();
    actionLock.current = false;
    setBusy(false);
    if (failed.length)
      showUndo(failed, `${failed.length} 项未撤销，可核对后重试`);
  }
  function showUndo(changes: ScheduledNoticeChange[], message: string) {
    undoToast.current = toast(message, {
      id: "inbox-notice-action",
      duration: 15000,
      action: { label: "撤销", onClick: () => void restore(changes) },
    });
  }
  async function markItems(items: ScheduledRunNotice[], action: MarkAction) {
    if (actionLock.current) return;
    const targets = items.filter((item) => needsMark(item, action));
    if (!targets.length) return;
    actionLock.current = true;
    setBusy(true);
    setOperationError("");
    setFeedback(`正在处理 ${targets.length} 项…`);
    await reading.current;
    const changes: ScheduledNoticeChange[] = [];
    const failures: string[] = [];
    const succeeded = new Set<string>();
    for (const item of targets) {
      if (item.id === selectedId)
        readKey.current = `${item.id}:${item.updatedAt}`;
      try {
        changes.push(await markInbox(item.id, action, item.updatedAt));
        succeeded.add(item.id);
      } catch (reason) {
        failures.push(
          reason instanceof Error
            ? reason.message
            : "保存结果未确认，请刷新核对。",
        );
      }
    }
    setChecked(
      (previous) => new Map([...previous].filter(([id]) => !succeeded.has(id))),
    );
    const label =
      action === "done" ? "已处理" : action === "read" ? "已读" : "未读";
    const message = `${changes.length} 项已标为${label}${failures.length ? `，${failures.length} 项未完成` : ""}`;
    setFeedback(message);
    if (failures.length)
      setOperationError(
        `${failures[0]} 仍在当前列表的未完成项保留选择，可核对后重试。`,
      );
    await refreshLatest.current();
    actionLock.current = false;
    setBusy(false);
    if (changes.length) showUndo(changes, message);
  }
  async function rerun(target: ScheduledRun) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setOperationError("");
    retryRequest.current ??= {
      scheduleId: target.scheduleId,
      id: crypto.randomUUID(),
    };
    if (retryRequest.current.scheduleId !== target.scheduleId)
      retryRequest.current = {
        scheduleId: target.scheduleId,
        id: crypto.randomUUID(),
      };
    try {
      const result = await runSchedule(
        target.scheduleId,
        retryRequest.current.id,
      );
      if (!result.ok) {
        setOperationError(result.error);
        return;
      }
      retryRequest.current = null;
      navigate(scheduledWorkHref(result.run.id, returnTo ?? undefined));
      await refresh();
    } catch (reason) {
      setOperationError(
        reason instanceof Error
          ? reason.message
          : "重新运行的提交结果未确认，请核对原请求。",
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  const visible = data?.notices ?? [];
  const selectedItems = [...checked.values()];
  const primaryAction = filter === "attention" ? "done" : "read";
  const actionableCount = selectedItems.filter((item) =>
    needsMark(item, primaryAction),
  ).length;
  const resolveCount = selectedItems.filter(canResolve).length;
  const selectItem = (item: ScheduledRunNotice, value: boolean) => {
    setChecked((previous) => {
      const next = new Map(previous);
      if (value) next.set(item.id, item);
      else next.delete(item.id);
      return next;
    });
  };
  const member = (id: string) =>
    roles.find((role) => role.id === id)?.name ?? "成员暂不可用";
  const title = (item: ScheduledRunNotice) =>
    item.run.state === "waiting_permission"
      ? "需要你授权"
      : scheduleStateLabels[item.run.state];
  const updateSelection = (id: string | null) => {
    const next = new URLSearchParams(params);
    next.delete("returnTo");
    if (id) next.set("run", id);
    else next.delete("run");
    navigate(`/inbox${next.size ? `?${next}` : ""}`);
  };
  const handled = Boolean(notice?.resolvedAt && notice.kind !== "result");
  return (
    <div className="inbox-page">
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <h1 className="text-base font-semibold">收件箱</h1>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/schedules">
              <CalendarClock />
              定时任务
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="刷新收件箱"
            disabled={refreshing || busy}
            onClick={() => void Promise.all([refresh(), refreshDetail()])}
          >
            <RefreshCw
              className={
                refreshing ? "animate-spin motion-reduce:animate-none" : ""
              }
            />
          </Button>
        </div>
      </header>
      {operationError && (
        <Alert variant="destructive" className="m-3 w-auto">
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}
      <div className="inbox-workbench" data-focused={Boolean(selectedId)}>
        <aside className="inbox-list" aria-label="通知列表">
          <div className="flex flex-wrap gap-1 border-b p-3">
            {(
              [
                ["all", "全部"],
                ["unread", `未读${data?.unread ? ` ${data.unread}` : ""}`],
                [
                  "attention",
                  `待处理${data?.attention ? ` ${data.attention}` : ""}`,
                ],
              ] as const
            ).map(([value, label]) => (
              <Button
                size="sm"
                key={value}
                variant={filter === value ? "secondary" : "ghost"}
                disabled={busy}
                aria-pressed={filter === value}
                onClick={() => {
                  if (filter === value) return;
                  setData(null);
                  setChecked(new Map());
                  const next = new URLSearchParams(params);
                  if (value === "all") next.delete("filter");
                  else next.set("filter", value);
                  navigate(`/inbox${next.size ? `?${next}` : ""}`);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <SelectionBar
            selectedCount={checked.size}
            totalCount={visible.length}
            disabled={busy || !data}
            onClear={() => setChecked(new Map())}
            onSelectAll={(value) =>
              setChecked(
                value
                  ? new Map(visible.map((item) => [item.id, item]))
                  : new Map(),
              )
            }
            description={
              checked.size &&
              filter === "attention" &&
              resolveCount < checked.size
                ? `仅 ${resolveCount} 项可标为已处理；其余事项需打开工作核对。`
                : visible.length === 100
                  ? "当前显示最近 100 条，全选仅作用于当前列表。"
                  : undefined
            }
          >
            <Button
              size="sm"
              disabled={busy || actionableCount === 0}
              onClick={() => void markItems(selectedItems, primaryAction)}
            >
              {primaryAction === "done" ? "标为已处理" : "标为已读"}（
              {actionableCount}）
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={busy}>
                  更多
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  {(["read", "unread", "done"] as const)
                    .filter((action) => action !== primaryAction)
                    .map((action) => {
                      const count = selectedItems.filter((item) =>
                        needsMark(item, action),
                      ).length;
                      return (
                        <DropdownMenuItem
                          key={action}
                          disabled={!count}
                          onSelect={() => void markItems(selectedItems, action)}
                        >
                          {action === "read"
                            ? "标为已读"
                            : action === "unread"
                              ? "标为未读"
                              : "标为已处理"}
                          （{count}）
                        </DropdownMenuItem>
                      );
                    })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SelectionBar>
          {feedback && (
            <p
              role="status"
              className="border-b px-3 py-2 text-xs text-muted-foreground"
            >
              {feedback}
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {listError && (
              <Alert variant="destructive" className="m-3 w-auto">
                <AlertDescription>
                  {listError}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refresh()}
                  >
                    重新读取
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {!data && !listError ? (
              <p role="status" className="p-5 text-sm text-muted-foreground">
                正在读取通知…
              </p>
            ) : !data ? null : !data.notices.length ? (
              <p className="p-5 text-sm text-muted-foreground">
                {filter === "attention"
                  ? "没有待处理事项"
                  : filter === "unread"
                    ? "没有未读通知"
                    : "任务完成或需要你处理时，会出现在这里。"}
              </p>
            ) : (
              data.notices.map((item) => (
                <Item
                  key={item.id}
                  size="sm"
                  data-notice-id={item.id}
                  className={`group/notice w-full flex-nowrap items-start gap-2 rounded-none border-0 border-b border-l-2 px-3 py-3 ${selectedId === item.id ? "border-l-primary bg-accent" : checked.has(item.id) ? "border-l-transparent bg-accent/50" : "border-l-transparent hover:bg-accent/30"}`}
                >
                  <label className="flex min-h-8 shrink-0 cursor-pointer items-center px-1">
                    <Checkbox
                      checked={checked.has(item.id)}
                      disabled={busy}
                      aria-label={`选择 ${item.run.snapshot.title} ${scheduleAt(item.run.scheduledAt, item.run.snapshot.rule.timeZone)}`}
                      onCheckedChange={(value) =>
                        selectItem(item, value === true)
                      }
                    />
                  </label>
                  <button
                    className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    disabled={busy}
                    aria-current={selectedId === item.id ? "true" : undefined}
                    onClick={() => {
                      readKey.current = "";
                      updateSelection(item.id);
                    }}
                  >
                    <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {member(item.run.snapshot.roleId)}
                      </span>
                      {!item.readAt && (
                        <span
                          aria-label="未读"
                          className="size-2 shrink-0 rounded-full bg-primary"
                        />
                      )}
                    </span>
                    <span className="mt-1.5 block break-words text-sm font-medium">
                      {item.run.snapshot.title}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${scheduleRunTone(item.run.state, Boolean(item.resolvedAt && item.kind !== "result"))}`}
                    >
                      {title(item)}
                      {item.resolvedAt && item.kind !== "result"
                        ? " · 已处理"
                        : ""}
                    </span>
                    <time
                      dateTime={item.run.scheduledAt}
                      className="mt-1.5 block text-xs text-muted-foreground"
                    >
                      {item.run.manual ? "手动运行 · " : "定时触发 · "}
                      {scheduleAt(
                        item.run.scheduledAt,
                        item.run.snapshot.rule.timeZone,
                      )}
                    </time>
                  </button>
                  <ItemActions className="flex-col gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={busy || checked.size > 0}
                          aria-label={
                            canResolve(item)
                              ? "标为已处理"
                              : item.readAt
                                ? "标为未读"
                                : "标为已读"
                          }
                          onClick={() =>
                            void markItems(
                              [item],
                              canResolve(item)
                                ? "done"
                                : item.readAt
                                  ? "unread"
                                  : "read",
                            )
                          }
                        >
                          {canResolve(item) ? (
                            <Check />
                          ) : item.readAt ? (
                            <Mail />
                          ) : (
                            <MailOpen />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {canResolve(item)
                          ? "标为已处理"
                          : item.readAt
                            ? "标为未读"
                            : "标为已读"}
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={busy || checked.size > 0}
                          aria-label={`${item.run.snapshot.title}的操作`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onSelect={() =>
                              void markItems(
                                [item],
                                item.readAt ? "unread" : "read",
                              )
                            }
                          >
                            {item.readAt ? "标为未读" : "标为已读"}
                          </DropdownMenuItem>
                          {canResolve(item) && (
                            <DropdownMenuItem
                              onSelect={() => void markItems([item], "done")}
                            >
                              标为已处理
                            </DropdownMenuItem>
                          )}
                          {["failed", "missed"].includes(item.run.state) && (
                            <DropdownMenuItem
                              onSelect={() => void rerun(item.run)}
                            >
                              重新运行
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link
                              href={scheduleHref(
                                item.run.scheduleId,
                                scheduleReturnTo(returnTo),
                              )}
                            >
                              任务与历史
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ItemActions>
                </Item>
              ))
            )}
          </div>
        </aside>
        <section className="inbox-detail" aria-label="本次工作">
          {(error || runError) && (
            <Alert variant="destructive" className="m-3 w-auto">
              <AlertDescription>
                {error || runError}
                {runError && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refreshDetail()}
                  >
                    重新读取
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
              选择一条通知，查看结果或处理请求。
            </div>
          ) : !run && runError ? (
            <div className="p-4">
              <Button variant="outline" onClick={() => updateSelection(null)}>
                返回通知列表
              </Button>
            </div>
          ) : !run ? (
            <p role="status" className="p-6 text-sm text-muted-foreground">
              正在读取本次工作…
            </p>
          ) : (
            <>
              <header className="shrink-0 space-y-3 border-b p-4">
                <div className="flex items-start gap-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={returnTo ? undefined : "min-[821px]:hidden"}
                    aria-label={returnTo ? "返回任务来源" : "返回通知列表"}
                    title={returnTo ? "返回任务来源" : "返回通知列表"}
                    onClick={() =>
                      returnTo ? navigate(returnTo) : updateSelection(null)
                    }
                  >
                    <ArrowLeft />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-sm font-medium">
                      {run.snapshot.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.manual ? "手动运行" : "定时触发"} ·{" "}
                      {scheduleAt(run.scheduledAt, run.snapshot.rule.timeZone)}{" "}
                      ·{" "}
                      <Link
                        className="hover:underline"
                        href={`/members/${run.snapshot.roleId}`}
                      >
                        {member(run.snapshot.roleId)}
                      </Link>
                    </p>
                  </div>
                  <ScheduleRunStatus
                    state={run.state}
                    handled={handled}
                    current
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="ghost">
                    <Link
                      href={scheduleHref(
                        run.scheduleId,
                        scheduleReturnTo(returnTo),
                      )}
                    >
                      任务与历史
                    </Link>
                  </Button>
                  {notice && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void markItems(
                          [notice],
                          notice.readAt ? "unread" : "read",
                        )
                      }
                    >
                      {notice.readAt ? "标为未读" : "标为已读"}
                    </Button>
                  )}
                  {["failed", "missed"].includes(run.state) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void rerun(run)}
                      >
                        {busy ? "处理中…" : "重新运行"}
                      </Button>
                      {notice && !notice.resolvedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void markItems([notice], "done")}
                        >
                          标为已处理
                        </Button>
                      )}
                    </>
                  )}
                  {!run.snapshot.runtime && (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/members/${run.snapshot.roleId}?view=settings&section=runtime`}
                      >
                        配置成员
                      </Link>
                    </Button>
                  )}
                </div>
                {run.error && (
                  <p
                    role="status"
                    className={`break-words text-sm ${handled ? "text-muted-foreground" : scheduleRunTone(run.state)}`}
                  >
                    {handled ? "当次失败原因：" : ""}
                    {run.error}
                  </p>
                )}
              </header>
              <WorkConversation key={run.id} run={run} roles={roles} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
