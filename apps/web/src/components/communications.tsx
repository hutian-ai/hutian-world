"use client";
import { api } from "@/lib/api";
import {
  askConversation,
  controlConversation,
  inviteConversation,
  postConversation,
} from "@/lib/communication-actions";
import type {
  ChatDirectory,
  Conversation,
  RoomKind,
} from "@/lib/communications";
import {
  composerMessage,
  memberMentionFormatter,
} from "@/lib/conversation-mentions";
import Link from "@/lib/navigation";
import type { Reference } from "@/lib/resources";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AssistantRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { Thread } from "@hutian-ai/design/assistant-ui/thread.aui";
import { ChatSendButton } from "@hutian-ai/design/chat/send-button";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@hutian-ai/design/ui/dialog";
import { Input } from "@hutian-ai/design/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hutian-ai/design/ui/select";
import { Switch } from "@hutian-ai/design/ui/switch";
import {
  ArrowLeft,
  ArrowUpRight,
  Hash,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Square,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { projectActivity } from "./chat-execution";
import { ChatMentionChip, ChatMentionTrigger } from "./chat-mentions";
import { AssistantMessage } from "./conversations/assistant-message";
import { ComposerDraft } from "./conversations/composer-draft";
import {
  NewConversation,
  Welcome,
} from "./conversations/conversation-directory";
import { mergeConversation } from "./conversations/conversation-state";
import { executionLinks } from "./conversations/message-projection";
import { href, icons, labels } from "./conversations/navigation";
import { useConversationState } from "./conversations/use-conversation-state";
import { UserMessage } from "./conversations/user-message";
import { MemberExecutionSettings } from "./member-execution-settings";
export function Communications({
  directory,
  initial,
  selectedId,
  preferredAgentId,
  embedded = false,
}: {
  directory: ChatDirectory;
  initial: Conversation | null;
  selectedId?: string;
  preferredAgentId?: string;
  embedded?: boolean;
}) {
  const {
    state,
    setState,
    historyCursor,
    setHistoryCursor,
    historyError,
    setHistoryError,
    connectionError,
    refresh,
  } = useConversationState(initial, selectedId);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [followMode, setFollowMode] = useState("queue");
  const [composerText, setComposerText] = useState("");
  const [settingsPending, setSettingsPending] = useState(false);
  const [uploads, setUploads] = useState<
    Array<{ id: string; name: string; size: number }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const currentRoom = useRef(selectedId);
  currentRoom.current = selectedId;
  useEffect(() => {
    setUploads([]);
    setFollowMode("queue");
  }, [selectedId]);
  const retry = useRef<{ text: string; id: string } | null>(null);
  const steerRetry = useRef<{ key: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const selected = directory.rooms.find((r) => r.id === selectedId);
  const joined = state?.agents.filter((a) => a.joined) ?? [];
  const privatePeer =
    embedded && preferredAgentId
      ? joined.find((agent) => agent.id === preferredAgentId)
      : selected?.kind === "direct" && joined.length === 1
        ? joined[0]
        : undefined;
  const targetIds = privatePeer
    ? [privatePeer.id]
    : composerMessage(composerText).ids;
  const targets = joined.filter((a) => targetIds.includes(a.id));
  const agentId = targets.length === 1 ? targets[0]!.id : "";
  const selectedRole = targets.length === 1 ? targets[0]?.roleId : undefined;
  const privateScopeAvailable = Boolean(
    privatePeer && state?.members.length === 2 && selectedRole,
  );
  const [useMemory, setUseMemory] = useState(true);
  const [useKnowledge, setUseKnowledge] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  useEffect(() => {
    setUseMemory(true);
    setUseKnowledge(true);
    try {
      const saved = JSON.parse(
        localStorage.getItem(`hutian:conversation:${selectedId}`) ?? "null",
      );
      if (saved?.contextVersion === 1) {
        setUseMemory(saved.useMemory === true);
        setUseKnowledge(saved.useKnowledge === true);
      }
    } catch {
      /* Local preferences are optional when storage is unavailable. */
    }
    setPreferencesLoaded(true);
  }, [selectedId]);
  useEffect(() => {
    if (preferencesLoaded && selectedId)
      try {
        localStorage.setItem(
          `hutian:conversation:${selectedId}`,
          JSON.stringify({ contextVersion: 1, useMemory, useKnowledge }),
        );
      } catch {
        /* Local preferences are optional when storage is unavailable. */
      }
  }, [preferencesLoaded, selectedId, useMemory, useKnowledge]);
  const [preparing, setPreparing] = useState(false);
  const invocation = (id: string) => ({
    useMemory,
    useKnowledge,
    runtimeMode: "member" as const,
    expectedBindingVersion:
      joined.find((a) => a.id === id)?.runtimeBinding?.updatedAt ?? null,
  });
  const currentJob = agentId
    ? state?.jobs.find(
        (j) =>
          j.agentId === agentId && j.activity?.state === "running" && j.runId,
      )
    : undefined;
  const canSteer = Boolean(currentJob?.activity?.steering && !uploads.length);
  useEffect(() => {
    if (!currentJob) setFollowMode("queue");
  }, [currentJob?.runId]);
  const [stopping, setStopping] = useState(false);
  const stopOperation = useRef<{ runId: string; id: string } | null>(null);
  const escapeAt = useRef(0);
  useEffect(() => {
    if (!currentJob) setStopping(false);
  }, [currentJob?.runId, currentJob?.activity?.state]);
  async function stopCurrent() {
    if (!selectedId || !currentJob?.runId || stopping) return;
    if (stopOperation.current?.runId !== currentJob.runId)
      stopOperation.current = {
        runId: currentJob.runId,
        id: crypto.randomUUID(),
      };
    setStopping(true);
    setError("");
    try {
      const result = await controlConversation({
        roomId: selectedId,
        eventId: currentJob.eventId,
        agentId: currentJob.agentId,
        runId: currentJob.runId,
        operationId: stopOperation.current.id,
        kind: "stop",
      });
      if (!result.ok) {
        setError(result.error);
        setStopping(false);
      }
      await refresh();
    } catch {
      setError("停止结果未确认，请核对原运行。");
      setStopping(false);
    }
  }
  const active = state?.active?.roomId === selectedId;
  const messages = useMemo<ThreadMessageLike[]>(
    () =>
      state?.messages
        .flatMap((m): ThreadMessageLike[] => {
          const job = state.jobs.find((j) => j.replyEventId === m.id);
          const text = executionLinks(m.text, state.room.id, job);
          const base: ThreadMessageLike = {
            id: job ? `reply:${job.eventId}:${job.agentId}` : m.id,
            role: m.sender === "human" ? "user" : "assistant",
            content: [{ type: "text", text }],
            createdAt: new Date(m.timestamp),
            metadata: {
              custom: {
                name: m.name,
                requestEventId: job?.eventId,
                agentId: job?.agentId ?? m.agentId ?? undefined,
                dispatchPending: sending,
                mentions: state.agents
                  .filter((agent) => m.mentionedUserIds.includes(agent.userId))
                  .map((agent) => ({ id: agent.id, name: agent.name })),
                ...(m.sender === "human"
                  ? {
                      retryTargets: state.agents
                        .filter(
                          (a) =>
                            a.joined &&
                            m.mentionedUserIds.includes(a.userId) &&
                            !state.jobs.some(
                              (j) => j.eventId === m.id && j.agentId === a.id,
                            ) &&
                            !state.queue.some(
                              (q) => q.eventId === m.id && q.agentId === a.id,
                            ),
                        )
                        .map((a) => ({ id: a.id, name: a.name })),
                      requestReply: async (id: string, resume?: boolean) => {
                        const result = await askConversation({
                          roomId: state.room.id,
                          eventId: m.id,
                          agentId: id,
                          resume,
                          ...invocation(id),
                        });
                        if (!result.ok) setError(result.error);
                        else setError("");
                        await refresh();
                      },
                    }
                  : {}),
                ...(m.agentId
                  ? { resultSource: { roomId: state.room.id, eventId: m.id } }
                  : {}),
                attachments: m.attachments.map((file) => ({
                  ...file,
                  roomId: state.room.id,
                  eventId: m.id,
                })),
                queue: state.queue
                  .filter((q) => q.eventId === m.id)
                  .map((q) => ({
                    ...q,
                    roomId: state.room.id,
                    name:
                      state.agents.find((a) => a.id === q.agentId)?.name ??
                      "助手",
                  })),
                ...(job?.activity && job.runId
                  ? {
                      execution: {
                        showStop: !privatePeer,
                        references: job.references,
                        activity: job.activity,
                        origin: {
                          roomId: state.room.id,
                          eventId: job.eventId,
                          agentId: job.agentId,
                          runId: job.runId,
                        },
                        configuration: job.model
                          ? {
                              label: job.runtimeLabel,
                              model: job.model,
                              effort: job.config?.effort,
                            }
                          : undefined,
                      },
                    }
                  : {}),
                ...(job?.nodeId && job.provider
                  ? {
                      handoff: {
                        roomId: state.room.id,
                        sourceEventId: m.id,
                        agents: state.agents
                          .filter((a) => a.joined && a.id !== m.agentId)
                          .map((a) => ({
                            id: a.id,
                            name: a.name,
                            runtimeLabel: a.runtimeBinding?.label,
                          })),
                      },
                    }
                  : {}),
                jobs: state.jobs
                  .filter((j) => j.eventId === m.id)
                  .map((j) => ({
                    ...j,
                    name:
                      state.agents.find((a) => a.id === j.agentId)?.name ??
                      "助手",
                  })),
              },
            },
          };
          const working: ThreadMessageLike[] = state.jobs
            .filter(
              (j) =>
                j.eventId === m.id &&
                (!j.replyEventId ||
                  !state.messages.some((reply) => reply.id === j.replyEventId)),
            )
            .map((j) => ({
              id: `reply:${j.eventId}:${j.agentId}`,
              role: "assistant",
              status:
                j.activity &&
                !["completed", "failed", "cancelled"].includes(j.activity.state)
                  ? { type: "running" }
                  : { type: "complete", reason: "stop" },
              content: [
                {
                  type: "text",
                  text: executionLinks(
                    j.activity ? projectActivity(j.activity).final : "",
                    state.room.id,
                    j,
                  ),
                },
              ],
              createdAt: new Date(j.activity?.startedAt ?? m.timestamp),
              metadata: {
                custom: {
                  name:
                    state.agents.find((a) => a.id === j.agentId)?.name ??
                    "助手",
                  requestEventId: j.eventId,
                  agentId: j.agentId,
                  waitingFor: privatePeer
                    ? undefined
                    : (state.agents.find((a) => a.id === j.agentId)?.name ??
                      "助手"),
                  pendingLabel: j.activity
                    ? undefined
                    : ({
                        queued: "等待执行",
                        accepted: "工作中",
                        preparing: "工作中",
                        running: "工作中",
                        failed: "未能开始",
                        cancelled: "已取消",
                      }[j.state] ?? "正在核对状态"),
                  execution:
                    j.activity && j.runId
                      ? {
                          showStop: !privatePeer,
                          references: j.references,
                          activity: j.activity,
                          origin: {
                            roomId: state.room.id,
                            eventId: j.eventId,
                            agentId: j.agentId,
                            runId: j.runId!,
                          },
                          configuration: j.model
                            ? {
                                label: j.runtimeLabel,
                                model: j.model,
                                effort: j.config?.effort,
                              }
                            : undefined,
                        }
                      : undefined,
                },
              },
            }));
          return [base, ...working];
        })
        .sort((a, b) => {
          const position = (item: ThreadMessageLike) => {
            const custom = item.metadata?.custom;
            const source = String(custom?.requestEventId ?? item.id);
            const index = state.messages.findIndex((m) => m.id === source);
            const agent = state.agents.find((x) => x.id === custom?.agentId);
            const mentions = state.messages[index]?.mentionedUserIds ?? [];
            const order = agent ? mentions.indexOf(agent.userId) : -1;
            return (
              (index < 0 ? state.messages.length : index) * 1000 +
              (custom?.requestEventId ? 1 + Math.max(0, order) : 0)
            );
          };
          return position(a) - position(b);
        }) ?? [],
    [state, sending, useMemory, useKnowledge],
  );
  const runtime: AssistantRuntime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    hasEarlier: Boolean(historyCursor),
    onLoadEarlier: async () => {
      if (!selectedId || !historyCursor) return;
      const roomId = selectedId;
      setHistoryError("");
      try {
        const page = await api<Conversation>(
          `/v2/transport/chat-history?${new URLSearchParams({ room: roomId, cursor: historyCursor })}`,
        );
        if (currentRoom.current !== roomId) return;
        setState((previous) =>
          previous ? mergeConversation(page, previous) : page,
        );
        setHistoryCursor(
          page.nextCursor === historyCursor ? null : page.nextCursor,
        );
      } catch {
        if (currentRoom.current === roomId)
          setHistoryError("较早消息暂不可读取。");
      }
    },
    convertMessage: (message) => message,
    isRunning: false,
    isDisabled: !state || !preferencesLoaded,
    isSendDisabled: sending || uploading || settingsPending,
    onNew: async (message) => {
      if (!selectedId || inFlight.current) return;
      const raw = message.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("\n")
        .trim();
      const parsed = composerMessage(raw);
      const text = parsed.text;
      const addressed = privatePeer ? [privatePeer.id] : parsed.ids;
      if (addressed.some((id) => !joined.some((a) => a.id === id))) {
        setError("点名成员已不可用，请移除或重新选择后发送。");
        runtime.thread.composer.setText(raw);
        return;
      }
      if (settingsPending) {
        setError("执行配置尚未确认，请重新读取后发送。");
        runtime.thread.composer.setText(raw);
        return;
      }
      if (addressed.length === 1 && followMode === "steer") {
        if (!currentJob?.runId || !canSteer) {
          setError("当前工作暂不能接收补充，请选择排下一轮。");
          runtime.thread.composer.setText(raw);
          return;
        }
        setSending(true);
        inFlight.current = true;
        const key = JSON.stringify([currentJob.runId, text]);
        if (steerRetry.current?.key !== key)
          steerRetry.current = { key, id: crypto.randomUUID() };
        try {
          const result = await controlConversation({
            roomId: selectedId,
            eventId: currentJob.eventId,
            agentId: currentJob.agentId,
            runId: currentJob.runId,
            operationId: steerRetry.current.id,
            kind: "steer",
            text,
          });
          if (result.ok) {
            steerRetry.current = null;
            setFollowMode("queue");
          } else {
            setError(result.error);
            runtime.thread.composer.setText(raw);
          }
          await refresh();
        } catch {
          setError("补充结果未确认，请沿原操作重试核对。");
          runtime.thread.composer.setText(raw);
        } finally {
          setSending(false);
          inFlight.current = false;
        }
        return;
      }
      for (const id of addressed) {
        const target = joined.find((a) => a.id === id)!;
        if (!target.runtimeBinding) {
          setError(`请先配置 ${target.name} 使用的运行环境。`);
          runtime.thread.composer.setText(raw);
          return;
        }
      }
      const messageKey = JSON.stringify([
        text,
        addressed,
        uploads.map((file) => file.id),
      ]);
      const transaction =
        retry.current?.text === messageKey
          ? retry.current
          : { text: messageKey, id: crypto.randomUUID() };
      retry.current = transaction;
      inFlight.current = true;
      setSending(true);
      setError("");
      let sentEventId: string | undefined;
      try {
        const sent = await postConversation({
          roomId: selectedId,
          text,
          transactionId: transaction.id,
          uploadIds: uploads.map((file) => file.id),
          mentionedAgentIds: addressed,
        });
        if (!sent.ok) {
          setError(sent.error);
          runtime.thread.composer.setText(raw);
          return;
        }
        sentEventId = sent.eventId;
        retry.current = null;
        setUploads([]);
        await refresh();
        const errors: string[] = [];
        const sources: Reference[] = [];
        setPreparing(addressed.length > 0);
        for (const id of addressed) {
          const asked = await askConversation({
            roomId: selectedId,
            eventId: sent.eventId,
            agentId: id,
            ...invocation(id),
          });
          if (!asked.ok)
            errors.push(
              `${joined.find((a) => a.id === id)?.name}：${asked.error}`,
            );
          else sources.push(...asked.references);
        }
        if (errors.length)
          setError(
            `消息已保存。${errors.join("；")} 请在该消息下重试对应成员。`,
          );
        await refresh();
      } catch {
        setError(
          sentEventId
            ? "消息已保存，执行提交结果待核对；请在原消息下继续。"
            : "发送结果未确认，请沿原消息核对。",
        );
        if (!sentEventId) runtime.thread.composer.setText(raw);
      } finally {
        inFlight.current = false;
        setSending(false);
        setPreparing(false);
      }
    },
  });
  return (
    <div
      className={
        embedded
          ? "communication-page schedule-work-chat"
          : "communication-page"
      }
    >
      <AssistantRuntimeProvider runtime={runtime}>
        {selectedId && (
          <ComposerDraft
            roomId={selectedId}
            runtime={runtime}
            onText={setComposerText}
          />
        )}
        <div
          className="communication-workbench"
          data-focused={Boolean(selectedId)}
        >
          {!embedded && (
            <aside className="communication-directory" aria-label="会话目录">
              <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
                <div>
                  <h1 className="text-sm font-semibold">沟通</h1>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {directory.rooms.length} 段共同的工作记录
                  </p>
                </div>
                <NewConversation directory={directory} />
              </header>
              <div className="relative m-3">
                <Search className="absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
                <Input
                  className="h-9 pl-9 text-xs"
                  aria-label="搜索会话"
                  placeholder="搜索对话与频道"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                {(Object.keys(labels) as RoomKind[]).map((kind) => {
                  const items = directory.rooms.filter(
                    (r) => r.kind === kind && r.name.includes(search),
                  );
                  const Icon = icons[kind];
                  return (
                    <section key={kind} className="mb-5">
                      <h2 className="mb-1 flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
                        <Icon className="size-3.5" />
                        {labels[kind]}
                        <span className="ml-auto text-[10px]">
                          {items.length}
                        </span>
                      </h2>
                      {items.map((r) => (
                        <Button
                          asChild
                          key={r.id}
                          variant="ghost"
                          className={`my-0.5 h-12 w-full justify-start gap-2.5 px-2 ${r.id === selectedId ? "bg-accent" : ""}`}
                        >
                          <Link href={href(r.id)} prefetch={false}>
                            <span
                              aria-hidden="true"
                              className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${kind === "direct" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                            >
                              {kind === "direct" ? (
                                r.name.replace(/^私聊 ·\s*/, "").slice(0, 1)
                              ) : (
                                <Icon className="size-3.5" />
                              )}
                            </span>
                            <span className="min-w-0 truncate text-[13px] font-normal">
                              {r.name.replace(/^私聊 ·\s*/, "")}
                            </span>
                          </Link>
                        </Button>
                      ))}
                      {!items.length && (
                        <p className="px-2 py-2 text-xs text-faint">
                          {search ? "没有匹配的会话" : "从右上角 ＋ 开始"}
                        </p>
                      )}
                    </section>
                  );
                })}
              </nav>
            </aside>
          )}
          <section className="communication-thread-pane" aria-label="当前对话">
            {state && selected ? (
              <>
                <header
                  className={
                    embedded
                      ? "hidden"
                      : "flex h-16 shrink-0 items-center gap-3 border-b px-4"
                  }
                >
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-sm"
                    className={embedded ? "hidden" : "min-[821px]:hidden"}
                  >
                    <Link href="/chat" aria-label="返回会话目录">
                      <ArrowLeft />
                    </Link>
                  </Button>
                  <span className="flex size-8 items-center justify-center rounded-md border bg-primary/5 text-primary">
                    {selected.kind === "channel" ? (
                      <Hash className="size-4" />
                    ) : (
                      <MessageCircle className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-medium">
                      {privatePeer?.roleId ? (
                        <Link
                          href={`/members/${privatePeer.roleId}`}
                          className="hover:underline"
                        >
                          {privatePeer.name}
                        </Link>
                      ) : (
                        selected.name.replace(/^私聊 ·\s*/, "")
                      )}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {labels[selected.kind]} · {state.members.length} 位成员
                      {active ? " · 助手正在处理" : ""}
                    </p>
                  </div>
                  {privatePeer?.roleId && (
                    <MemberExecutionSettings
                      agent={privatePeer}
                      disabled={sending}
                      onPending={setSettingsPending}
                      onRefresh={refresh}
                      onSaved={(binding) =>
                        setState((previous) =>
                          previous
                            ? {
                                ...previous,
                                agents: previous.agents.map((a) =>
                                  a.id === privatePeer.id
                                    ? {
                                        ...a,
                                        runtimeBinding: binding
                                          ? {
                                              ...binding,
                                              preferences:
                                                binding.preferences ?? {},
                                            }
                                          : null,
                                      }
                                    : a,
                                ),
                              }
                            : previous,
                        )
                      }
                    />
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <UsersRound className="size-3.5" />
                        成员
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>对话成员</DialogTitle>
                        <DialogDescription>
                          {selected.kind === "direct"
                            ? "私聊保留两位参与者；多人讨论请从会话目录新建群聊。"
                            : "邀请成员不会自动触发执行。"}
                        </DialogDescription>
                      </DialogHeader>
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      <details className="rounded border p-3 text-sm">
                        <summary className="cursor-pointer">资料与记忆</summary>
                        <div className="mt-3 space-y-3">
                          <label className="flex items-center justify-between gap-4">
                            自动参考知识库
                            <Switch
                              checked={useKnowledge}
                              onCheckedChange={setUseKnowledge}
                            />
                          </label>
                          <label className="flex items-center justify-between gap-4">
                            自动参考记忆
                            <Switch
                              checked={useMemory}
                              onCheckedChange={setUseMemory}
                            />
                          </label>
                          <div className="flex flex-wrap gap-3 text-xs">
                            <Link
                              className="underline"
                              href={`/knowledge?${new URLSearchParams({ room: selectedId! })}`}
                            >
                              会话资料
                            </Link>
                            <Link
                              className="underline"
                              href={`/memory?${new URLSearchParams({ room: selectedId! })}`}
                            >
                              会话记忆
                            </Link>
                            {privateScopeAvailable && (
                              <Link
                                className="underline"
                                href={`/members/${selectedRole}?view=resources`}
                              >
                                成员资料
                              </Link>
                            )}
                          </div>
                        </div>
                      </details>
                      {state.members.map((m) => {
                        const member = state.agents.find(
                          (a) => a.userId === m.id,
                        );
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 border-b py-2 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="truncate">
                                {member?.name ?? m.name}
                              </div>
                              {member?.roleId && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {member.runtimeBinding?.label ??
                                    "未配置运行环境"}
                                </p>
                              )}
                            </div>
                            {member?.roleId ? (
                              <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="shrink-0 text-xs"
                              >
                                <Link
                                  href={`/members/${member.roleId}?view=settings&section=runtime`}
                                  aria-label={`配置${member.name}`}
                                >
                                  执行配置
                                  <ArrowUpRight className="size-3" />
                                </Link>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {m.kind === "agent" ? "助手" : "成员"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {state.agents
                        .filter(
                          (a) =>
                            selected.kind !== "direct" &&
                            !a.joined &&
                            !a.roleId &&
                            !/^role-[\da-f]{32}$/.test(a.id),
                        )
                        .map((a) => (
                          <Button
                            key={a.id}
                            variant="outline"
                            onClick={async () => {
                              const r = await inviteConversation(
                                selected.id,
                                a.id,
                              );
                              if (!r.ok) setError(r.error);
                              await refresh();
                            }}
                          >
                            邀请 {a.name}
                          </Button>
                        ))}
                      {directory.roles
                        .filter(
                          (role) =>
                            selected.kind !== "direct" &&
                            !state.agents.some(
                              (a) => a.roleId === role.id && a.joined,
                            ),
                        )
                        .map((role) => (
                          <Button
                            key={role.id}
                            variant="outline"
                            disabled={sending || active}
                            onClick={async () => {
                              setSending(true);
                              setError("");
                              try {
                                const result = await inviteConversation(
                                  selected.id,
                                  `role:${role.id}`,
                                );
                                if (!result.ok) setError(result.error);
                                await refresh();
                              } catch {
                                setError(
                                  "邀请结果待核对，请刷新原会话后继续。",
                                );
                              } finally {
                                setSending(false);
                              }
                            }}
                          >
                            邀请 {role.name}
                          </Button>
                        ))}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="刷新会话"
                    onClick={() => void refresh()}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </header>
                <div className="min-h-0 flex-1">
                  <Thread
                    historyError={historyError}
                    components={{ AssistantMessage, UserMessage }}
                    autoFocus={false}
                    composer={{
                      placeholder: privatePeer
                        ? "输入消息…"
                        : "发消息，或 @成员 请他处理…",
                      formatter: memberMentionFormatter,
                      directiveChip: ChatMentionChip,
                      trigger: !privatePeer && (
                        <ChatMentionTrigger agents={joined} />
                      ),
                      onStopShortcut:
                        privatePeer && currentJob
                          ? () => {
                              const now = Date.now();
                              if (now - escapeAt.current < 2000) {
                                escapeAt.current = 0;
                                void stopCurrent();
                              } else {
                                escapeAt.current = now;
                                setError(
                                  "再次按 Esc 停止当前工作，输入内容会保留。",
                                );
                              }
                            }
                          : undefined,
                      afterInput: (
                        <>
                          <input
                            ref={uploadInput}
                            type="file"
                            className="hidden"
                            aria-label="附加文件"
                            multiple
                            onChange={async (e) => {
                              const files = [...(e.target.files ?? [])];
                              e.target.value = "";
                              setFollowMode("queue");
                              if (
                                !selectedId ||
                                uploads.length + files.length > 5 ||
                                uploads.reduce((n, f) => n + f.size, 0) +
                                  files.reduce((n, f) => n + f.size, 0) >
                                  16 * 1024 * 1024
                              ) {
                                setError(
                                  "每条消息最多五份文件，总计不超过 16 MB。",
                                );
                                return;
                              }
                              setUploading(true);
                              setError("");
                              try {
                                for (const file of files) {
                                  const form = new FormData();
                                  form.append("roomId", selectedId);
                                  form.append("file", file);
                                  const value = await api<{
                                    id: string;
                                    name: string;
                                    size: number;
                                  }>("/v2/transport/chat-upload", "POST", form);
                                  if (currentRoom.current === selectedId)
                                    setUploads((previous) => [
                                      ...previous,
                                      value,
                                    ]);
                                }
                              } catch (error) {
                                setError(
                                  error instanceof Error
                                    ? error.message
                                    : "上传未完成。",
                                );
                              } finally {
                                setUploading(false);
                              }
                            }}
                          />
                          {uploads.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 px-2 pb-1 text-xs text-muted-foreground">
                              {uploads.map((file) => (
                                <span
                                  key={file.id}
                                  className="inline-flex max-w-48 items-center gap-1 rounded border px-1.5"
                                >
                                  <Paperclip className="size-3" />
                                  <span className="truncate">{file.name}</span>
                                  <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    aria-label={`移除 ${file.name}`}
                                    disabled={sending}
                                    onClick={() =>
                                      setUploads((previous) =>
                                        previous.filter(
                                          (f) => f.id !== file.id,
                                        ),
                                      )
                                    }
                                  >
                                    <X className="size-3" />
                                  </Button>
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      ),
                      actions: (
                        <div className="flex min-w-0 items-center gap-1 px-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="附加文件"
                            title="附加文件"
                            disabled={sending || uploading}
                            onClick={() => uploadInput.current?.click()}
                          >
                            <Plus className="size-4" />
                          </Button>
                          <div className="ml-auto flex shrink-0 items-center gap-1">
                            {uploading && (
                              <span className="text-xs text-muted-foreground">
                                上传中…
                              </span>
                            )}
                            {targetIds.length > 0 &&
                              currentJob &&
                              composerText.trim() && (
                                <Select
                                  value={followMode}
                                  onValueChange={(v) => {
                                    if (v) setFollowMode(v);
                                  }}
                                  disabled={sending}
                                >
                                  <SelectTrigger
                                    aria-label="执行中发送方式"
                                    className="h-7 w-auto gap-1 border-0 bg-transparent px-1 text-xs shadow-none"
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="queue">
                                      排下一轮
                                    </SelectItem>
                                    <SelectItem
                                      value="steer"
                                      disabled={!canSteer}
                                    >
                                      补充当前工作
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            {privatePeer &&
                              currentJob &&
                              composerText.trim() && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="停止当前工作"
                                  disabled={stopping}
                                  onClick={() => void stopCurrent()}
                                >
                                  <Square className="size-3" />
                                </Button>
                              )}
                            <ChatSendButton
                              busy={sending || uploading || settingsPending}
                              stopping={stopping}
                              stop={
                                privatePeer && currentJob
                                  ? stopCurrent
                                  : undefined
                              }
                              attachments={uploads.length > 0}
                              label={
                                followMode === "steer" && currentJob
                                  ? "补充当前工作"
                                  : targetIds.length && (active || state.active)
                                    ? "排队发送"
                                    : privatePeer || targetIds.length
                                      ? "发送"
                                      : "发送到群聊"
                              }
                            />
                          </div>
                        </div>
                      ),
                      before: (
                        <div className="grid gap-2">
                          {sending && !preparing && (
                            <p
                              role="status"
                              className="text-xs text-muted-foreground"
                            >
                              正在发送…
                            </p>
                          )}
                          {(error || connectionError) && (
                            <Alert variant="destructive">
                              <AlertDescription>
                                {error || connectionError}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      ),
                    }}
                  />
                </div>
              </>
            ) : (
              <Welcome directory={directory} />
            )}
          </section>
        </div>
      </AssistantRuntimeProvider>
    </div>
  );
}
