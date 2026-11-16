"use client";
import Link from "@/lib/navigation";
import { useRouter } from "@/lib/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  ActionBarPrimitive,
  useAuiState,
  useAui,
  useExternalStoreRuntime,
  type AssistantRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Hash,
  MessageCircle,
  Plus,
  Search,
  UsersRound,
  RefreshCw,
  Brain,
  BookOpen,
  Copy,
  Paperclip,
  X,
  Square,
  ChevronDown,
} from "lucide-react";
import { Switch } from "@hutian-ai/design/ui/switch";
import { MemberExecutionSettings } from "./member-execution-settings";
import { ChatMentionTrigger, ChatMentionChip } from "./chat-mentions";
import {
  memberMentionFormatter,
  composerMessage,
} from "@/lib/conversation-mentions";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@hutian-ai/design/ui/popover";
import { ChatSendButton } from "@hutian-ai/design/chat/send-button";
import {
  AssistantMessageBody,
  ChatMessageRoot,
  UserMessageBubble,
  ChatPending,
} from "@hutian-ai/design/chat/message";
import { Thread } from "@hutian-ai/design/assistant-ui/thread.aui";
import { MarkdownText } from "@hutian-ai/design/assistant-ui/markdown-text";
import { Button } from "@hutian-ai/design/ui/button";
import { Input } from "@hutian-ai/design/ui/input";
import { Textarea } from "@hutian-ai/design/ui/textarea";
import { Avatar, AvatarFallback } from "@hutian-ai/design/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@hutian-ai/design/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hutian-ai/design/ui/select";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import type {
  ChatDirectory,
  Conversation,
  RoomKind,
} from "@/lib/communications";
import {
  askConversation,
  createCommunication,
  inviteConversation,
  postConversation,
  refreshConversation,
  controlConversation,
  controlConversationQueue,
  handoffConversation,
} from "@/lib/communication-actions";
import type { Reference } from "@/lib/resources";
import { ChatExecution, projectActivity } from "./chat-execution";
import type { ExecutionActivity } from "@hutian-world/contracts";
import { saveChatResult } from "@/lib/chat-result-actions";

const labels = { direct: "私聊", group: "群聊", channel: "频道" };
const icons = { direct: MessageCircle, group: UsersRound, channel: Hash };
function mergeConversation(
  previous: Conversation | null,
  incoming: Conversation,
): Conversation {
  if (!previous || previous.room.id !== incoming.room.id) return incoming;
  return {
    ...incoming,
    agents: incoming.agents.map((agent) => {
      const previousAgent = previous.agents.find((a) => a.id === agent.id);
      const currentBinding = previousAgent?.runtimeBinding;
      return currentBinding &&
        agent.runtimeBinding &&
        currentBinding.updatedAt > agent.runtimeBinding.updatedAt
        ? { ...agent, runtimeBinding: currentBinding }
        : agent;
    }),
    messages: [
      ...new Map(
        [...previous.messages, ...incoming.messages].map((m) => [m.id, m]),
      ).values(),
    ].sort((a, b) => a.timestamp - b.timestamp),
    jobs: [
      ...new Map(
        [...previous.jobs, ...incoming.jobs].map((j) => [
          `${j.eventId}:${j.agentId}`,
          (() => {
            const old = previous.jobs.find(
              (x) => x.runId && x.runId === j.runId,
            );
            const seq = (a: ExecutionActivity | null | undefined) =>
              a?.revision ?? -1;
            return old?.activity && seq(old.activity) > seq(j.activity)
              ? { ...j, activity: old.activity }
              : j;
          })(),
        ]),
      ).values(),
    ],
  };
}
function ComposerDraft({
  roomId,
  runtime,
  onText,
}: {
  roomId: string;
  runtime: AssistantRuntime;
  onText(text: string): void;
}) {
  useEffect(() => {
    const key = `hutian:draft:${roomId}`;
    try {
      runtime.thread.composer.setText(localStorage.getItem(key) ?? "");
    } catch {}
    onText(runtime.thread.composer.getState().text);
    return runtime.thread.composer.subscribe(() => {
      onText(runtime.thread.composer.getState().text);
      try {
        localStorage.setItem(key, runtime.thread.composer.getState().text);
      } catch {}
    });
  }, [roomId, runtime, onText]);
  return null;
}
function href(id: string) {
  return `/chat?${new URLSearchParams({ room: id })}`;
}
function executionLinks(
  text: string,
  roomId: string,
  job?: Conversation["jobs"][number],
) {
  return text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (link, label: string, target: string) => {
      let path = target;
      try {
        path = decodeURIComponent(target);
      } catch {}
      const file = job?.activity?.outputs.find(
        (o) => o.reference === path || o.name === path,
      );
      if (file && job?.runId)
        return `[${label}](/api/chat-output?${new URLSearchParams({ roomId, eventId: job.eventId, agentId: job.agentId, runId: job.runId, reference: file.reference })})`;
      // A native path is not a Web download URL. The original reply is retained in
      // Matrix; expose a download only after the host has confirmed the exact file.
      return /^(?:file:\/\/|\/(?:Users|home|tmp|private|Volumes|var)\/|[a-z]:[\\/])/i.test(
        path,
      )
        ? label
        : link;
    },
  );
}
function AssistantMessage() {
  const aui = useAui();
  const messageText = useAuiState((s) =>
    s.message.content
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n"),
  );
  const source = useAuiState(
    (s) =>
      s.message.metadata.custom.resultSource as
        { roomId: string; eventId: string } | undefined,
  );
  const name = useAuiState(
    (s) => s.message.metadata.custom.name as string | undefined,
  );
  const execution = useAuiState(
    (s) =>
      s.message.metadata.custom.execution as
        | {
            activity: ExecutionActivity;
            origin: {
              roomId: string;
              eventId: string;
              agentId: string;
              runId: string;
            };
            showStop?: boolean;
            references?: Array<{ id: string; title: string; url: string }>;
            configuration?: {
              label?: string | null;
              model?: string | null;
              effort?: string;
            };
          }
        | undefined,
  );
  const pendingLabel = useAuiState(
    (s) => s.message.metadata.custom.pendingLabel as string | undefined,
  );
  const waitingFor = useAuiState(
    (s) => s.message.metadata.custom.waitingFor as string | undefined,
  );
  const body = useAuiState((s) =>
    s.message.content.some((p) => p.type === "text" && p.text.trim()),
  );
  const handoff = useAuiState(
    (s) =>
      s.message.metadata.custom.handoff as
        | {
            roomId: string;
            sourceEventId: string;
            agents: Array<{ id: string; name: string; runtimeLabel?: string }>;
          }
        | undefined,
  );
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState(
    "请基于这份交付继续整理，保留已确认结果与来源。",
  );
  const [handing, setHanding] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const [handoffOpen, setHandoffOpen] = useState(false);
  const handoffTransaction = useRef<{ key: string; id: string } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveKind, setSaveKind] = useState<"memory" | "knowledge">("memory");
  const [saveScope, setSaveScope] = useState("workspace");
  const [saveTitle, setSaveTitle] = useState("");
  const [saveText, setSaveText] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveRequest = useRef<{ key: string; id: string } | null>(null);
  const renderBody = (content: ReactNode) => (
    <AssistantMessageBody name={name} status={pendingLabel}>
      {content}
      {body &&
        (!execution ||
          ["completed", "failed", "cancelled"].includes(
            execution.activity.state,
          )) && (
          <ActionBarPrimitive.Root className="mt-2 flex gap-2">
            <ActionBarPrimitive.Copy asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 text-xs text-muted-foreground"
              >
                <Copy className="size-3" />
                复制
              </Button>
            </ActionBarPrimitive.Copy>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1 text-xs text-muted-foreground"
                >
                  更多
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="flex w-72 flex-col items-stretch gap-1 p-2 [&>button]:justify-start"
                align="start"
              >
                {execution && (
                  <details className="p-2 text-xs">
                    <summary className="cursor-pointer">运行详情</summary>
                    <p className="py-2">
                      本轮请求：
                      {[
                        execution.configuration?.label,
                        execution.configuration?.model,
                        execution.configuration?.effort,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {Boolean(execution.references?.length) && (
                      <>
                        <p>提供给此成员的资料</p>
                        <ul>
                          {execution.references?.map((r, i) => (
                            <li key={`${r.id}:${i}`}>
                              <Link href={r.url} className="underline">
                                {r.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </details>
                )}
                {source && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-1 text-xs text-muted-foreground"
                      onClick={() =>
                        aui.thread
                          .composer()
                          .setText(
                            `> ${messageText.split("\n").join("\n> ")}\n\n`,
                          )
                      }
                    >
                      引用
                    </Button>
                    <Dialog
                      open={saveOpen}
                      onOpenChange={(open) => {
                        setSaveOpen(open);
                        if (open) {
                          setSaveText(messageText);
                          setSaveTitle(
                            messageText
                              .split("\n")
                              .find((line) => line.trim())
                              ?.replace(/^#+\s*/, "")
                              .slice(0, 60) ?? "工作结果",
                          );
                          setSaveStatus("");
                          setSaved(false);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1 text-xs text-muted-foreground"
                        >
                          保存结果
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>保存这份工作结果</DialogTitle>
                          <DialogDescription>
                            可修改内容；保存时附上原消息与版本。会话共享内容可被本会话成员使用。
                          </DialogDescription>
                        </DialogHeader>
                        <Select
                          value={saveKind}
                          onValueChange={(v) =>
                            setSaveKind(v as "memory" | "knowledge")
                          }
                        >
                          <SelectTrigger aria-label="保存类型">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="memory">整理为记忆</SelectItem>
                            <SelectItem value="knowledge">
                              加入知识资料
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={saveScope} onValueChange={setSaveScope}>
                          <SelectTrigger aria-label="保存范围">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="workspace">
                              个人工作台
                            </SelectItem>
                            <SelectItem value="conversation">
                              当前会话共享
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          aria-label="结果标题"
                          maxLength={80}
                          value={saveTitle}
                          onChange={(e) => setSaveTitle(e.target.value)}
                        />
                        <Textarea
                          aria-label="保存内容"
                          className="min-h-48"
                          value={saveText}
                          onChange={(e) => setSaveText(e.target.value)}
                          maxLength={18000}
                        />
                        {saveStatus && (
                          <p
                            role="status"
                            className="text-sm text-muted-foreground"
                          >
                            {saveStatus}
                          </p>
                        )}
                        {saved && (
                          <Link
                            className="text-sm underline underline-offset-4"
                            href={`/${saveKind}${saveScope === "conversation" ? `?${new URLSearchParams({ room: source.roomId })}` : ""}`}
                          >
                            查看保存范围
                          </Link>
                        )}
                        <Button
                          disabled={
                            saving || !saveText.trim() || !saveTitle.trim()
                          }
                          onClick={async () => {
                            const key = JSON.stringify([
                              source,
                              saveTitle,
                              saveText,
                              saveKind,
                              saveScope,
                            ]);
                            if (saveRequest.current?.key !== key)
                              saveRequest.current = {
                                key,
                                id: crypto.randomUUID(),
                              };
                            setSaving(true);
                            try {
                              const result = await saveChatResult({
                                ...source,
                                id: saveRequest.current.id,
                                kind: saveKind,
                                title: saveTitle,
                                content: saveText,
                                scope:
                                  saveScope === "workspace"
                                    ? { kind: "workspace" }
                                    : {
                                        kind: "conversation",
                                        id: source.roomId,
                                      },
                              });
                              setSaved(result.ok);
                              setSaveStatus(
                                result.ok
                                  ? result.status === "completed" ||
                                    result.status === "ready"
                                    ? "已保存。可前往对应记忆或资料范围查看。"
                                    : "原保存操作已提交，整理结果可在对应记忆或资料页核对。"
                                  : result.error,
                              );
                            } finally {
                              setSaving(false);
                            }
                          }}
                        >
                          {saving ? "保存中" : "保存"}
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
                {handoff && handoff.agents.length > 0 && (
                  <Dialog open={handoffOpen} onOpenChange={setHandoffOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1 text-xs text-muted-foreground"
                      >
                        请另一位继续
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>交给另一位成员继续</DialogTitle>
                        <DialogDescription>
                          引用这条回复，使用当前会话共享范围。
                          {target
                            ? `接手成员运行环境：${handoff.agents.find((a) => a.id === target)?.runtimeLabel ?? "未配置，请先进入成员执行配置"}。`
                            : "使用接手成员的默认运行环境、模型与推理等级。"}
                        </DialogDescription>
                      </DialogHeader>
                      <Select value={target} onValueChange={setTarget}>
                        <SelectTrigger aria-label="接手成员">
                          <SelectValue placeholder="选择已加入的成员" />
                        </SelectTrigger>
                        <SelectContent>
                          {handoff.agents.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!handoff.agents.length && (
                        <p className="text-sm text-muted-foreground">
                          请先通过会话成员入口邀请接手成员。
                        </p>
                      )}
                      <Textarea
                        aria-label="交接要求"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                      />
                      {handoffError && (
                        <Alert variant="destructive">
                          <AlertDescription>{handoffError}</AlertDescription>
                        </Alert>
                      )}
                      <Button
                        disabled={
                          handing ||
                          !target ||
                          !goal.trim() ||
                          !handoff.agents.find((a) => a.id === target)
                            ?.runtimeLabel
                        }
                        onClick={async () => {
                          const key = JSON.stringify([
                            handoff.sourceEventId,
                            target,
                            goal,
                          ]);
                          if (handoffTransaction.current?.key !== key)
                            handoffTransaction.current = {
                              key,
                              id: crypto.randomUUID(),
                            };
                          setHanding(true);
                          setHandoffError("");
                          try {
                            const result = await handoffConversation({
                              roomId: handoff.roomId,
                              sourceEventId: handoff.sourceEventId,
                              agentId: target,
                              text: goal,
                              transactionId: handoffTransaction.current.id,
                            });
                            if (result.ok) setHandoffOpen(false);
                            else setHandoffError(result.error);
                          } finally {
                            setHanding(false);
                          }
                        }}
                      >
                        {handing ? "正在交接" : "发送交接"}
                      </Button>
                    </DialogContent>
                  </Dialog>
                )}
              </PopoverContent>
            </Popover>
          </ActionBarPrimitive.Root>
        )}
    </AssistantMessageBody>
  );
  return (
    <ChatMessageRoot role="assistant">
      {execution ? (
        <ChatExecution
          {...execution}
          hasAnswer={body}
          waitingFor={waitingFor}
          renderBody={renderBody}
        >
          {body && (
            <div data-slot="turn-answer">
              <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
            </div>
          )}
        </ChatExecution>
      ) : pendingLabel && !body ? (
        <ChatPending label={pendingLabel} waitingFor={waitingFor} />
      ) : (
        renderBody(
          body && (
            <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
          ),
        )
      )}
    </ChatMessageRoot>
  );
}
function UserMessage() {
  const [queueBusy, setQueueBusy] = useState("");
  const [queueError, setQueueError] = useState("");
  const [replyBusy, setReplyBusy] = useState("");
  const retryTargets = useAuiState(
    (s) =>
      s.message.metadata.custom.retryTargets as
        Array<{ id: string; name: string }> | undefined,
  );
  const requestReply = useAuiState(
    (s) =>
      s.message.metadata.custom.requestReply as
        ((agentId: string, resume?: boolean) => Promise<void>) | undefined,
  );
  const dispatchPending = useAuiState((s) =>
    Boolean(s.message.metadata.custom.dispatchPending),
  );
  async function changeQueue(
    item: { id: string; roomId: string },
    action: "start" | "cancel",
  ) {
    setQueueBusy(item.id);
    setQueueError("");
    try {
      const result = await controlConversationQueue({
        roomId: item.roomId,
        id: item.id,
        action,
      });
      if (!result.ok) setQueueError(result.error);
    } catch {
      setQueueError("排队操作未确认，请核对原消息后重试。");
    } finally {
      setQueueBusy("");
    }
  }
  const jobs = useAuiState(
    (s) =>
      s.message.metadata.custom.jobs as
        Array<Conversation["jobs"][number] & { name: string }> | undefined,
  );
  const queue = useAuiState(
    (s) =>
      s.message.metadata.custom.queue as
        | Array<
            Conversation["queue"][number] & { roomId: string; name?: string }
          >
        | undefined,
  );
  const attachments = useAuiState(
    (s) =>
      s.message.metadata.custom.attachments as
        | Array<{ id: string; name: string; roomId: string; eventId: string }>
        | undefined,
  );
  const names: Record<string, string> = {
    running: "正在处理",
    replied: "已回复",
    completed: "执行完成，回复待核对",
    unknown: "结果待核对",
    failed: "未完成",
    cancelled: "已取消",
    idle: "尚未执行",
    accepted: "已接收，准备执行",
    preparing: "准备执行",
    queued: "等待执行入口",
    blocked: "执行暂受阻",
  };
  return (
    <ChatMessageRoot role="user">
      <UserMessageBubble>
        <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
      </UserMessageBubble>
      {attachments?.map((file) => (
        <a
          key={file.id}
          className="text-xs underline underline-offset-4"
          href={`/api/chat-input?${new URLSearchParams({ id: file.id, roomId: file.roomId, eventId: file.eventId })}`}
        >
          {file.name}
        </a>
      ))}
      {queue?.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span>
            {item.name} · {item.state === "paused" ? "等待已暂停" : "等待执行"}
          </span>
          {item.state === "paused" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              disabled={Boolean(queueBusy)}
              onClick={() => void changeQueue(item, "start")}
            >
              {queueBusy === item.id ? "提交中" : "开始处理"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            disabled={Boolean(queueBusy)}
            onClick={() => void changeQueue(item, "cancel")}
          >
            移除
          </Button>
        </div>
      ))}
      {queueError && (
        <p role="alert" className="text-xs text-destructive">
          {queueError}
        </p>
      )}
      {!dispatchPending &&
        retryTargets?.map((a) => (
          <Button
            key={a.id}
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={Boolean(replyBusy) || dispatchPending}
            onClick={async () => {
              setReplyBusy(a.id);
              try {
                await requestReply?.(a.id);
              } finally {
                setReplyBusy("");
              }
            }}
          >
            {replyBusy === a.id ? "正在核对" : `重试 ${a.name} 的请求`}
          </Button>
        ))}
      {jobs
        ?.filter(
          (j) =>
            j.runId &&
            ["unknown", "completed", "failed", "blocked"].includes(j.state),
        )
        .map((j) => (
          <Button
            key={`observe:${j.agentId}`}
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={Boolean(replyBusy)}
            onClick={async () => {
              setReplyBusy(j.agentId);
              try {
                await requestReply?.(j.agentId, true);
              } finally {
                setReplyBusy("");
              }
            }}
          >
            核对 {j.name} 的原运行
          </Button>
        ))}
      {jobs
        ?.filter((job) => !job.activity && !queue?.length && Boolean(job.error))
        .map((job) => (
          <details
            key={job.agentId}
            className="max-w-[90%] text-[11px] text-muted-foreground"
          >
            <summary className="cursor-pointer">
              {job.name} · {names[job.state] ?? "状态待核对"}
            </summary>
            <div className="mt-1 rounded-md border px-3 py-2">
              {job.error && <p>{job.error}</p>}
              {job.instructionsLabel && (
                <p>本次成员：{job.instructionsLabel}</p>
              )}
              {job.instructionsVersion && (
                <p title={job.instructionsVersion}>
                  人设版本：
                  {job.instructionsVersion.split("#").at(-1)?.slice(0, 12)}
                </p>
              )}
              {job.instructionsSource?.match(
                /^hutian:\/\/roles\/[\da-f-]{36}$/,
              ) && (
                <Link
                  className="underline underline-offset-4"
                  href={`/members/${job.instructionsSource.split("/").at(-1)}?view=capabilities&section=definition`}
                >
                  查看当前成员配置
                </Link>
              )}
              {(job.runtimeLabel || job.nodeId) && (
                <p>
                  本次选择：
                  {job.runtimeLabel || `${job.nodeId} · ${job.provider ?? ""}`}
                </p>
              )}
              <p>原运行：{job.runId ?? "尚未取得回执"}</p>
              <p>记录保留；未知结果不会自动派发替代运行。</p>
            </div>
          </details>
        ))}
    </ChatMessageRoot>
  );
}
function conversationPeers(directory: ChatDirectory) {
  return [
    ...directory.roles.map((r) => ({
      id: `role:${r.id}`,
      name: r.name,
      description: r.description,
      roleId: r.id,
    })),
    ...directory.agents
      .filter((a) => !a.roleId && !/^role-[\da-f]{32}$/.test(a.id))
      .map((a) => ({ ...a, roleId: undefined })),
  ];
}
function NewConversation({ directory }: { directory: ChatDirectory }) {
  const agents = conversationPeers(directory);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RoomKind>("direct");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<{ key: string; id: string } | null>(null);
  async function create() {
    const title =
      name.trim() ||
      (kind === "direct" ? agents.find((a) => a.id === selected[0])?.name : "");
    if (!title) {
      setError("请输入会话名称。");
      return;
    }
    const key = JSON.stringify({ kind, name: title, agentIds: selected });
    const transaction =
      retry.current?.key === key
        ? retry.current
        : { key, id: crypto.randomUUID() };
    retry.current = transaction;
    setBusy(true);
    setError("");
    try {
      const result = await createCommunication({
        kind,
        name: title,
        agentIds: selected.filter((id) => !id.startsWith("role:")),
        roleIds: selected
          .filter((id) => id.startsWith("role:"))
          .map((id) => id.slice(5)),
        transactionId: transaction.id,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      retry.current = null;
      setOpen(false);
      setName("");
      setSelected([]);
      router.push(href(result.roomId));
      router.refresh();
    } catch {
      setError("创建结果未确认，再次创建会核对原请求。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label="新建会话">
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>开始一段对话</DialogTitle>
          <DialogDescription>
            选择私聊、群聊或长期主题频道。加入会话不会自动启动助手。
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(labels) as RoomKind[]).map((k) => (
            <Button
              key={k}
              variant={k === kind ? "secondary" : "outline"}
              onClick={() => {
                setKind(k);
                if (k === "direct") setSelected(selected.slice(0, 1));
              }}
            >
              {labels[k]}
            </Button>
          ))}
        </div>
        <label className="grid gap-2 text-xs">
          {kind === "direct" ? "会话名称（可选）" : "名称"}
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              kind === "channel"
                ? "例如：产品讨论"
                : kind === "group"
                  ? "例如：方案协作"
                  : "默认使用助手名称"
            }
            maxLength={80}
          />
        </label>
        <div className="grid gap-1">
          <p className="mb-1 text-xs text-muted-foreground">
            {kind === "direct" ? "选择一位成员" : "邀请成员（可稍后添加）"}
          </p>
          {agents.map((a) => (
            <Button
              key={a.id}
              variant={selected.includes(a.id) ? "secondary" : "ghost"}
              className="h-auto justify-start py-2.5"
              onClick={() =>
                setSelected(
                  kind === "direct"
                    ? [a.id]
                    : selected.includes(a.id)
                      ? selected.filter((id) => id !== a.id)
                      : [...selected, a.id],
                )
              }
            >
              <span className="flex size-7 items-center justify-center rounded-md border bg-primary/10 text-primary">
                {a.name.slice(0, 1)}
              </span>
              <span className="grid min-w-0 flex-1 text-left">
                <span className="truncate">{a.name}</span>
                <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                  {a.description}
                </span>
              </span>
              <span className="ml-auto">
                {selected.includes(a.id) ? "✓" : ""}
              </span>
            </Button>
          ))}
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button
          onClick={() => void create()}
          disabled={busy || (kind === "direct" && selected.length !== 1)}
        >
          {busy ? "正在建立…" : "开始对话"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
function Welcome({ directory }: { directory: ChatDirectory }) {
  const agents = conversationPeers(directory);
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <span className="mb-6 flex size-10 items-center justify-center rounded-xl border bg-primary/5 text-primary">
          <MessageCircle className="size-5" />
        </span>
        <p className="mb-2 text-xs text-muted-foreground">
          与你的助手一起，把事情往前推进
        </p>
        <h2 className="text-2xl font-medium tracking-tight">
          今天想一起做点什么？
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          从左侧继续一段对话，或创建私聊、群聊和频道。发出消息时，可以明确选择由哪位助手接着处理。
        </p>
        <div className="mt-7 border-t pt-5">
          <p className="mb-3 text-xs text-muted-foreground">
            可以一起工作的成员 · {agents.length}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {agents.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <Avatar className="size-8 rounded-md">
                  <AvatarFallback className="rounded-md bg-primary/10 text-primary">
                    {a.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex gap-4 text-xs text-muted-foreground">
          <Link className="hover:text-foreground" href="/runtimes">
            查看运行环境 ↗
          </Link>
          <Link className="hover:text-foreground" href="/members">
            管理成员 ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
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
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [historyCursor, setHistoryCursor] = useState(
    initial?.nextCursor ?? null,
  );
  const [loadingHistory, setLoadingHistory] = useState(false);
  const threadContainer = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
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
  const [references, setReferences] = useState<Reference[]>([]);
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
    } catch {}
    setPreferencesLoaded(true);
  }, [selectedId]);
  useEffect(() => {
    if (preferencesLoaded && selectedId)
      try {
        localStorage.setItem(
          `hutian:conversation:${selectedId}`,
          JSON.stringify({ contextVersion: 1, useMemory, useKnowledge }),
        );
      } catch {}
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
  async function refresh() {
    if (!selectedId) return;
    const r = await refreshConversation(selectedId);
    if (r.ok) {
      setState((previous) => mergeConversation(previous, r.conversation));
      setConnectionError("");
      return true;
    } else {
      setConnectionError(r.error);
      return false;
    }
  }
  useEffect(() => {
    if (!selectedId) return;
    let events: EventSource | undefined;
    const offline = () => {
      events?.close();
      setConnectionError("网络已离线，消息与原运行保留；联网后自动核对。");
    };
    const connect = () => {
      events?.close();
      if (!navigator.onLine) {
        offline();
        return;
      }
      events = new EventSource(
        `/api/chat-events?${new URLSearchParams({ room: selectedId })}`,
      );
      events.onmessage = (event) => {
        try {
          const snapshot = JSON.parse(event.data) as Conversation;
          setState((previous) => mergeConversation(previous, snapshot));
          setConnectionError("");
        } catch {
          setConnectionError("会话状态暂未确认，请刷新核对。");
        }
      };
      events.addEventListener("activity", (event) => {
        try {
          const update = JSON.parse((event as MessageEvent).data);
          if (!update.activity) return;
          setState((previous) =>
            previous
              ? {
                  ...previous,
                  jobs: previous.jobs.map((job) =>
                    job.runId === update.runId &&
                    (update.activity.revision ?? 0) >=
                      (job.activity?.revision ?? 0)
                      ? { ...job, activity: update.activity }
                      : job,
                  ),
                }
              : previous,
          );
        } catch {
          /* The next authoritative snapshot reconciles a malformed event. */
        }
      });
      events.addEventListener("unavailable", () =>
        setConnectionError("连接中断，正在核对原运行；不会重新派发。"),
      );
      events.onerror = () =>
        setConnectionError("连接中断，正在重新连接原会话。");
    };
    const online = () => {
      setConnectionError("网络已恢复，正在核对原会话。");
      connect();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    connect();
    return () => {
      events?.close();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [selectedId]);
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
                agentId: job?.agentId,
                dispatchPending: sending,
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
        setReferences(sources);
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
                <div ref={threadContainer} className="min-h-0 flex-1">
                  <Thread
                    beforeMessages={
                      historyCursor && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loadingHistory}
                          className="self-center text-xs text-muted-foreground"
                          onClick={async () => {
                            const viewport =
                              threadContainer.current?.querySelector(
                                '[data-slot="aui_thread-viewport"]',
                              );
                            const height = viewport?.scrollHeight ?? 0;
                            const top = viewport?.scrollTop ?? 0;
                            setLoadingHistory(true);
                            try {
                              const response = await fetch(
                                `/api/chat-history?${new URLSearchParams({ room: selectedId!, cursor: historyCursor })}`,
                              );
                              if (!response.ok) throw new Error();
                              const page =
                                (await response.json()) as Conversation;
                              setState((previous) =>
                                mergeConversation(page, previous!),
                              );
                              setHistoryCursor(
                                page.nextCursor === historyCursor
                                  ? null
                                  : page.nextCursor,
                              );
                              requestAnimationFrame(() =>
                                requestAnimationFrame(() => {
                                  if (viewport)
                                    viewport.scrollTop =
                                      top + viewport.scrollHeight - height;
                                }),
                              );
                            } catch {
                              setError("较早历史暂不可读取，请稍后重试。");
                            } finally {
                              setLoadingHistory(false);
                            }
                          }}
                        >
                          {loadingHistory ? "正在读取" : "加载更早消息"}
                        </Button>
                      )
                    }
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
                                  const response = await fetch(
                                    "/api/chat-upload",
                                    { method: "POST", body: form },
                                  );
                                  const value = await response.json();
                                  if (!response.ok)
                                    throw new Error(value.error);
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
