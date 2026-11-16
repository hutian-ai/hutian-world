import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Link, { useSearchParams } from "@/lib/navigation";
import { ArrowLeft, CalendarClock, RefreshCw } from "lucide-react";
import type {
  Role,
  ScheduledInbox,
  ScheduledRun,
  ScheduledRunNotice,
} from "@hutian-world/contracts";
import { loadInbox, loadInboxNotice, markInbox } from "@/lib/inbox";
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
    if (!notice || notice.id !== selectedId || notice.readAt) return;
    const key = `${notice.id}:${notice.updatedAt}`;
    if (readKey.current === key) return;
    readKey.current = key;
    void markInbox(notice.id, "read", notice.updatedAt)
      .then(() => Promise.all([refresh(), refreshDetail()]))
      .catch(() => {
        readKey.current = "";
        setError("已读状态未保存，请重新打开这条通知。");
      });
  }, [notice, selectedId, refresh, refreshDetail]);
  async function mark(action: "read" | "unread" | "done") {
    if (!notice) return;
    setBusy(true);
    setError("");
    readKey.current = `${notice.id}:${notice.updatedAt}`;
    try {
      await markInbox(notice.id, action, notice.updatedAt);
      await Promise.all([refresh(), refreshDetail()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "通知状态未保存。");
    } finally {
      setBusy(false);
    }
  }
  async function rerun() {
    if (!run || busy) return;
    setBusy(true);
    setError("");
    retryRequest.current ??= {
      scheduleId: run.scheduleId,
      id: crypto.randomUUID(),
    };
    if (retryRequest.current.scheduleId !== run.scheduleId)
      retryRequest.current = {
        scheduleId: run.scheduleId,
        id: crypto.randomUUID(),
      };
    try {
      const result = await runSchedule(run.scheduleId, retryRequest.current.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      retryRequest.current = null;
      navigate(scheduledWorkHref(result.run.id, returnTo ?? undefined));
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "重新运行的提交结果未确认，请核对原请求。",
      );
    } finally {
      setBusy(false);
    }
  }
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
            disabled={refreshing}
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
                aria-pressed={filter === value}
                onClick={() => {
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
                <button
                  key={item.id}
                  className={`w-full border-b border-l-2 px-4 py-3 text-left hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2 ${selectedId === item.id ? "border-l-primary bg-accent" : "border-l-transparent"}`}
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
                        void mark(notice.readAt ? "unread" : "read")
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
                        onClick={() => void rerun()}
                      >
                        {busy ? "处理中…" : "重新运行"}
                      </Button>
                      {notice && !notice.resolvedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void mark("done")}
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
