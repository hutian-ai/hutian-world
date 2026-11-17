"use client";
import { createCommunication } from "@/lib/communication-actions";
import type { ChatDirectory, RoomKind } from "@/lib/communications";
import Link, { useRouter } from "@/lib/navigation";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { Avatar, AvatarFallback } from "@hutian-ai/design/ui/avatar";
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
import { MessageCircle, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { href, labels } from "./navigation";
export function conversationPeers(directory: ChatDirectory) {
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
export function NewConversation({ directory }: { directory: ChatDirectory }) {
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
export function Welcome({ directory }: { directory: ChatDirectory }) {
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
