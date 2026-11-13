"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  MessagePrimitive,
  useAuiState,
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
} from "lucide-react";
import { Thread } from "@/components/assistant-ui/thread.aui";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  ChatDirectory,
  Conversation,
  RoomKind,
} from "@/lib/communications";
import {
  askConversation,
  createCommunication,
  discoverChatRuntimes,
  inviteConversation,
  postConversation,
  refreshConversation,
} from "@/lib/communication-actions";
import type { Reference } from "@/lib/resources";

const labels = { direct: "私聊", group: "群聊", channel: "频道" };
const icons = { direct: MessageCircle, group: UsersRound, channel: Hash };
function href(id: string) {
  return `/chat?${new URLSearchParams({ room: id })}`;
}
function AssistantMessage() {
  const name = useAuiState(
    (s) => s.message.metadata.custom.name as string | undefined,
  );
  return (
    <MessagePrimitive.Root className="mx-auto flex w-full max-w-3xl gap-3 px-4 py-4">
      <Avatar className="mt-0.5 size-7 rounded-md border">
        <AvatarFallback className="rounded-md bg-primary/10 text-xs text-primary">
          {name?.slice(0, 1) || "助"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-2 text-xs font-medium">{name || "助手"}</div>
        <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
      </div>
    </MessagePrimitive.Root>
  );
}
function UserMessage() {
  const jobs = useAuiState(
    (s) =>
      s.message.metadata.custom.jobs as
        | Array<Conversation["jobs"][number] & { name: string }>
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
  };
  return (
    <MessagePrimitive.Root className="mx-auto flex w-full max-w-3xl flex-col items-end gap-2 px-4 py-3">
      <div className="max-w-[90%] rounded-lg border bg-muted/40 px-4 py-2.5">
        <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
      </div>
      {jobs?.map((job) => (
        <details
          key={job.agentId}
          className="max-w-[90%] text-[11px] text-muted-foreground"
        >
          <summary className="cursor-pointer">
            {job.name} · {names[job.state] ?? "状态待核对"}
          </summary>
          <div className="mt-1 rounded-md border px-3 py-2">
            {job.error && <p>{job.error}</p>}
            <p>原运行：{job.runId ?? "尚未取得回执"}</p>
            <p>记录保留；未知结果不会自动派发替代运行。</p>
          </div>
        </details>
      ))}
    </MessagePrimitive.Root>
  );
}
function NewConversation({ agents }: { agents: ChatDirectory["agents"] }) {
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
        agentIds: selected,
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
            {kind === "direct" ? "选择一位助手" : "邀请助手（可稍后添加）"}
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
              <span className="grid text-left">
                <span>{a.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
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
function Welcome({ agents }: { agents: ChatDirectory["agents"] }) {
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
            已接入的助手 · {agents.length}
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
}: {
  directory: ChatDirectory;
  initial: Conversation | null;
  selectedId?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [sending, setSending] = useState(false);
  const [agentId, setAgentId] = useState(
    initial?.agents.filter((a) => a.joined).length === 1
      ? initial.agents.find((a) => a.joined)!.id
      : "",
  );
  const retry = useRef<{ text: string; id: string } | null>(null);
  const inFlight = useRef(false);
  const selected = directory.rooms.find((r) => r.id === selectedId);
  const joined = state?.agents.filter((a) => a.joined) ?? [];
  const [useMemory, setUseMemory] = useState(false);
  const [useKnowledge, setUseKnowledge] = useState(false);
  const [references, setReferences] = useState<Reference[]>([]);
  const [runtimes, setRuntimes] = useState<
    { nodeId: string; provider: string; label: string }[]
  >([]);
  const [runtimeKey, setRuntimeKey] = useState("select");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  useEffect(() => {
    if (!selectedId) return;
    try {
      const saved = JSON.parse(
        localStorage.getItem(`hutian:conversation:${selectedId}`) ?? "null",
      );
      if (saved && typeof saved === "object") {
        if (
          typeof saved.agentId === "string" &&
          (saved.agentId === "" || joined.some((a) => a.id === saved.agentId))
        )
          setAgentId(saved.agentId);
        if (
          saved.runtime &&
          typeof saved.runtime.nodeId === "string" &&
          typeof saved.runtime.provider === "string" &&
          typeof saved.runtime.label === "string"
        ) {
          setRuntimes([saved.runtime]);
          setRuntimeKey(saved.runtime.nodeId + "::" + saved.runtime.provider);
        }
        setUseMemory(saved.useMemory === true);
        setUseKnowledge(saved.useKnowledge === true);
      }
    } catch {
      /* Browser preferences never replace server authorization. */
    }
    setPreferencesLoaded(true);
  }, [selectedId]);
  useEffect(() => {
    if (!preferencesLoaded || !selectedId) return;
    const selectedRuntime = runtimes.find(
      (r) => r.nodeId + "::" + r.provider === runtimeKey,
    );
    try {
      localStorage.setItem(
        `hutian:conversation:${selectedId}`,
        JSON.stringify({
          agentId,
          runtime: selectedRuntime,
          useMemory,
          useKnowledge,
        }),
      );
    } catch {
      /* Storage can be unavailable; conversation facts remain on the server. */
    }
  }, [
    preferencesLoaded,
    selectedId,
    agentId,
    runtimeKey,
    useMemory,
    useKnowledge,
    runtimes,
  ]);
  const [preparing, setPreparing] = useState(false);
  async function discover() {
    const r = await discoverChatRuntimes();
    if (r.ok) setRuntimes(r.runtimes);
    else setError(r.error);
  }
  const invocation = () => ({
    useMemory,
    useKnowledge,
    ...(runtimeKey === "select"
      ? {}
      : {
          runtime: {
            nodeId: runtimeKey.split("::")[0]!,
            provider: runtimeKey.split("::")[1]!,
          },
        }),
  });
  const active = state?.active?.roomId === selectedId;
  async function refresh() {
    if (!selectedId) return;
    const r = await refreshConversation(selectedId);
    if (r.ok) {
      setState(r.conversation);
      setConnectionError("");
    } else setConnectionError(r.error);
  }
  useEffect(() => {
    if (!selectedId) return;
    let disposed = false;
    const timer = setInterval(() => {
      if (document.hidden) return;
      void refreshConversation(selectedId).then((r) => {
        if (disposed) return;
        if (r.ok) {
          setState(r.conversation);
          setConnectionError("");
        } else setConnectionError(r.error);
      });
    }, 2500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [selectedId]);
  const messages = useMemo<ThreadMessageLike[]>(
    () =>
      state?.messages.map((m) => ({
        id: m.id,
        role: m.sender === "human" ? "user" : "assistant",
        content: [{ type: "text", text: m.text }],
        createdAt: new Date(m.timestamp),
        metadata: {
          custom: {
            name: m.name,
            jobs: state.jobs
              .filter((j) => j.eventId === m.id)
              .map((j) => ({
                ...j,
                name:
                  state.agents.find((a) => a.id === j.agentId)?.name ?? "助手",
              })),
          },
        },
      })) ?? [],
    [state?.messages],
  );
  const runtime: AssistantRuntime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    convertMessage: (message) => message,
    isRunning: false,
    isDisabled: !state,
    isSendDisabled: sending,
    onNew: async (message) => {
      if (!selectedId || inFlight.current) return;
      const text = message.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("\n")
        .trim();
      if (agentId && runtimeKey === "select") {
        setError("先选择本次使用的 Runtime，再发送给助手。");
        runtime.thread.composer.setText(text);
        return;
      }
      const transaction =
        retry.current?.text === text
          ? retry.current
          : { text, id: crypto.randomUUID() };
      retry.current = transaction;
      inFlight.current = true;
      setSending(true);
      setError("");
      try {
        const sent = await postConversation({
          roomId: selectedId,
          text,
          transactionId: transaction.id,
        });
        if (!sent.ok) {
          setError(sent.error);
          runtime.thread.composer.setText(text);
          return;
        }
        retry.current = null;
        await refresh();
        if (agentId) {
          setPreparing(true);
          const asked = await askConversation({
            roomId: selectedId,
            eventId: sent.eventId,
            agentId,
            ...invocation(),
          });
          if (!asked.ok)
            setError(`消息已发送。${asked.error} 可在消息下方再次请求回复。`);
          else setReferences(asked.references);
          await refresh();
        }
      } catch {
        setError("发送结果未确认，请沿原消息核对。");
        runtime.thread.composer.setText(text);
      } finally {
        inFlight.current = false;
        setSending(false);
        setPreparing(false);
      }
    },
  });
  const lastHuman = state?.messages.findLast((m) => m.sender === "human");
  const lastJob = lastHuman
    ? state?.jobs.findLast(
        (j) => j.eventId === lastHuman.id && j.agentId === agentId,
      )
    : undefined;
  async function askAgain() {
    if (!selectedId || !lastHuman || !agentId) return;
    setSending(true);
    try {
      const r = await askConversation({
        roomId: selectedId,
        eventId: lastHuman.id,
        agentId,
        resume: Boolean(lastJob),
        ...invocation(),
      });
      if (!r.ok) setError(r.error);
      else setReferences(r.references);
      await refresh();
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="communication-page">
      <AssistantRuntimeProvider runtime={runtime}>
        <div
          className="communication-workbench"
          data-focused={Boolean(selectedId)}
        >
          <aside className="communication-directory" aria-label="会话目录">
            <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
              <div>
                <h1 className="text-sm font-semibold">沟通</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {directory.rooms.length} 段共同的工作记录
                </p>
              </div>
              <NewConversation agents={directory.agents} />
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
                  (r) =>
                    (r.name.startsWith("私聊 ·") ? "direct" : r.kind) ===
                      kind && r.name.includes(search),
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
            <div className="border-t px-4 py-3 text-[10px] text-muted-foreground">
              Matrix Agents Chat · 消息与执行分别保留
            </div>
          </aside>
          <section className="communication-thread-pane" aria-label="当前对话">
            {state && selected ? (
              <>
                <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon-sm"
                    className="min-[821px]:hidden"
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
                      {selected.name.replace(/^私聊 ·\s*/, "")}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {labels[selected.kind]} · {state.members.length} 位成员
                      {active ? " · 助手正在处理" : ""}
                    </p>
                  </div>
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
                          邀请成员不会自动触发执行。
                        </DialogDescription>
                      </DialogHeader>
                      {state.members.map((m) => (
                        <div
                          key={m.id}
                          className="flex justify-between border-b py-2 text-sm"
                        >
                          {m.name}
                          <span className="text-xs text-muted-foreground">
                            {m.kind === "agent" ? "助手" : "成员"}
                          </span>
                        </div>
                      ))}
                      {state.agents
                        .filter((a) => !a.joined)
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
                    components={{ AssistantMessage, UserMessage }}
                    autoFocus={false}
                    composer={{
                      placeholder: agentId
                        ? `发消息，并请${joined.find((a) => a.id === agentId)?.name ?? "助手"}处理…`
                        : "发一条消息…",
                      header: (
                        <div className="flex flex-wrap items-center gap-2 pb-2">
                          <Select
                            value={agentId || "none"}
                            onValueChange={(v) =>
                              setAgentId(v === "none" ? "" : v)
                            }
                            disabled={sending || active}
                          >
                            <SelectTrigger className="h-7 w-auto min-w-32 border-0 bg-transparent px-1.5 text-xs shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">只发送消息</SelectItem>
                              {joined.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  请 {a.name} 回复
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={runtimeKey}
                            onOpenChange={(v) => {
                              if (v) void discover();
                            }}
                            onValueChange={setRuntimeKey}
                            disabled={sending || active}
                          >
                            <SelectTrigger className="h-7 w-auto max-w-60 border-0 bg-transparent px-1.5 text-xs shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="select">
                                选择运行环境
                              </SelectItem>
                              {runtimes.map((r) => (
                                <SelectItem
                                  key={r.nodeId + "::" + r.provider}
                                  value={r.nodeId + "::" + r.provider}
                                >
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="ml-auto flex gap-1">
                            <Button
                              size="sm"
                              variant={useKnowledge ? "secondary" : "ghost"}
                              aria-pressed={useKnowledge}
                              className="h-7 px-2 text-xs"
                              onClick={() => setUseKnowledge(!useKnowledge)}
                            >
                              <BookOpen className="size-3" />
                              知识库
                            </Button>
                            <Button
                              size="sm"
                              variant={useMemory ? "secondary" : "ghost"}
                              aria-pressed={useMemory}
                              className="h-7 px-2 text-xs"
                              onClick={() => setUseMemory(!useMemory)}
                            >
                              <Brain className="size-3" />
                              记忆
                            </Button>
                          </div>
                        </div>
                      ),
                      before: (
                        <div className="grid gap-2">
                          {preparing && (
                            <p
                              role="status"
                              className="text-xs text-muted-foreground"
                            >
                              正在准备获授权的资料、记忆与执行入口…
                            </p>
                          )}
                          {references.length > 0 && (
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>本次参考</span>
                              {references.map((r, i) => (
                                <Link
                                  key={`${r.id}-${i}`}
                                  href={r.url}
                                  className="text-primary hover:underline"
                                >
                                  [{i + 1}] {r.title}
                                </Link>
                              ))}
                            </div>
                          )}
                          {(error || connectionError) && (
                            <Alert variant="destructive">
                              <AlertDescription>
                                {error || connectionError}
                              </AlertDescription>
                            </Alert>
                          )}
                          {active && (
                            <div
                              role="status"
                              className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground"
                            >
                              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                              助手正在处理，回复会回到当前对话。刷新后可继续查看。
                            </div>
                          )}
                          {!active &&
                            lastHuman &&
                            agentId &&
                            lastJob?.state !== "replied" && (
                              <Button
                                className="justify-self-start"
                                size="sm"
                                variant="outline"
                                disabled={sending}
                                onClick={() => void askAgain()}
                              >
                                {lastJob
                                  ? "核对原运行并收取回复"
                                  : "请助手处理上一条消息"}
                              </Button>
                            )}
                        </div>
                      ),
                    }}
                  />
                </div>
              </>
            ) : (
              <Welcome agents={directory.agents} />
            )}
          </section>
        </div>
      </AssistantRuntimeProvider>
    </div>
  );
}
