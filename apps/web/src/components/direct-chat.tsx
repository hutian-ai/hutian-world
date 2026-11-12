"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider, useExternalStoreRuntime,
  type AssistantRuntime, type ExternalStoreThreadListAdapter, type ThreadMessageLike,
} from "@assistant-ui/react";
import { ArrowLeft, MessageCircle, Plus, RefreshCw } from "lucide-react";
import { Thread } from "@/components/assistant-ui/thread.aui";
import { ThreadList } from "@/components/assistant-ui/thread-list.aui";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { openPrivateConversation, sendPrivateMessage } from "@/lib/chat-actions";
import type { ChatEntry, ChatMessage, ChatPeer } from "@/lib/direct-chat";

function chatHref(peerId: string) {
  return `/chat?${new URLSearchParams({ peer: peerId })}`;
}

function matrixMessage(message: ChatMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.sender === "human" ? "user" : "assistant",
    content: [{ type: "text", text: message.text }],
    createdAt: new Date(message.timestamp),
  };
}

function NewPrivateChat({ entries }: { entries: ChatEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const opening = useRef(false);

  async function select(peer: ChatPeer) {
    if (opening.current) return;
    opening.current = true;
    setError(undefined);
    setPending(peer.id);
    try {
      const result = await openPrivateConversation(peer.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push(chatHref(peer.id));
      router.refresh();
    } catch {
      setError("打开结果尚未确认。重新选择同一位对象可以继续核对。");
    } finally {
      opening.current = false;
      setPending(undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!opening.current) setOpen(value); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="新建私聊" title="新建私聊"><Plus /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建私聊</DialogTitle>
          <DialogDescription>选择一位聊天对象。已有的私聊会继续使用原会话。</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[50dvh] gap-1 overflow-auto" aria-busy={Boolean(pending)}>
          {entries.map(({ peer, exists }) => (
            <Button key={peer.id} type="button" variant="ghost" className="h-auto justify-start gap-3 px-2 py-2 text-left" disabled={Boolean(pending)} onClick={() => void select(peer)}>
              <Avatar className="size-8 rounded-md border"><AvatarFallback className="rounded-md bg-primary/10 text-primary">{peer.name.slice(0, 1)}</AvatarFallback></Avatar>
              <span className="table-copy flex-1"><strong>{peer.name}</strong><small>{peer.description || "聊天助手"}</small></span>
              {pending === peer.id ? <Spinner /> : <span className="text-xs text-muted-foreground">{exists ? "打开" : "开始"}</span>}
            </Button>
          ))}
          {!entries.length && <p className="text-sm text-muted-foreground">当前没有可私聊的对象。</p>}
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </DialogContent>
    </Dialog>
  );
}

export function DirectChat({ directory, selected, messages, error }: {
  directory: ChatEntry[];
  selected?: ChatPeer;
  messages: ChatMessage[];
  error?: string;
}) {
  const router = useRouter();
  const [sendError, setSendError] = useState<string>();
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const retry = useRef<{ text: string; id: string } | null>(null);
  const threads = useMemo<ExternalStoreThreadListAdapter>(() => ({
    threadId: selected?.id,
    threads: directory.filter((entry) => entry.exists).map(({ peer }) => ({
      status: "regular",
      id: peer.id,
      remoteId: peer.id,
      title: peer.name,
      custom: { kind: "direct", initial: peer.name.slice(0, 1), participantLabel: "私聊", activityLabel: "" },
    })),
    onSwitchToThread: (id) => { if (!inFlight.current) router.push(chatHref(id)); },
  }), [directory, router, selected?.id]);

  const runtime: AssistantRuntime = useExternalStoreRuntime<ChatMessage>({
    messages,
    convertMessage: matrixMessage,
    adapters: { threadList: threads },
    isRunning: false,
    isSendDisabled: sending,
    isDisabled: !selected || Boolean(error),
    onNew: async (message) => {
      if (!selected || inFlight.current) return;
      const text = message.content.map((part) => part.type === "text" ? part.text : "").join("\n").trim();
      const transaction = retry.current?.text === text ? retry.current : { text, id: crypto.randomUUID() };
      retry.current = transaction;
      inFlight.current = true;
      setSending(true);
      setSendError(undefined);
      try {
        const result = await sendPrivateMessage(selected.id, text, transaction.id);
        if (!result.ok) {
          setSendError(result.error);
          runtime.thread.composer.setText(text);
          return;
        }
        retry.current = null;
        router.refresh();
      } catch {
        setSendError("发送结果尚未确认，可以重新发送原消息以核对。");
        runtime.thread.composer.setText(text);
      } finally {
        inFlight.current = false;
        setSending(false);
      }
    },
  });

  return (
    <div className="communication-page">
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="communication-workbench" data-focused={Boolean(selected)}>
          <aside className="communication-directory" aria-label="私聊目录">
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
              <div><h1 className="text-sm font-semibold">私聊</h1><p className="mt-0.5 text-xs text-muted-foreground">{directory.filter((entry) => entry.exists).length} 个会话</p></div>
              <NewPrivateChat entries={directory} />
            </header>
            <ThreadList showNew={false} searchPlaceholder="搜索私聊" emptySearchLabel="还没有可显示的私聊"
              className="min-h-0 flex-1 gap-1 p-2" itemsClassName="min-h-0 flex-1 overflow-y-auto" />
            {!selected && error && <Alert className="m-2 w-auto" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </aside>
          <section className="communication-thread-pane" aria-label="当前私聊">
            {selected ? (
              <>
                <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4">
                  <Button asChild variant="ghost" size="icon-sm" className="min-[821px]:hidden"><Link href="/chat" aria-label="返回私聊目录"><ArrowLeft /></Link></Button>
                  <Avatar className="size-8 rounded-md border"><AvatarFallback className="rounded-md bg-primary/10 text-primary">{selected.name.slice(0, 1)}</AvatarFallback></Avatar>
                  <div className="table-copy flex-1"><strong>{selected.name}</strong><small>私聊</small></div>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="刷新消息" title="刷新消息" onClick={() => router.refresh()}><RefreshCw /></Button>
                </header>
                {error ? <Alert className="m-4 w-auto" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : (
                  <div className="min-h-0 flex-1">
                    <Thread autoFocus={false} composer={{
                      placeholder: `发消息给${selected.name}…`,
                      before: sendError ? <Alert variant="destructive"><AlertDescription>{sendError}</AlertDescription></Alert> : undefined,
                    }} />
                  </div>
                )}
              </>
            ) : <div className="flex flex-1 items-center justify-center"><EmptyState title="选择私聊" detail="从会话目录打开已有私聊，或选择一位对象开始沟通。" icon={MessageCircle} /></div>}
          </section>
        </div>
      </AssistantRuntimeProvider>
    </div>
  );
}
