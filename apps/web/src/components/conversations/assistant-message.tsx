"use client";
import { saveChatResult } from "@/lib/chat-result-actions";
import { handoffConversation } from "@/lib/communication-actions";
import Link from "@/lib/navigation";
import {
  ActionBarPrimitive,
  MessagePrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { MarkdownText } from "@hutian-ai/design/assistant-ui/markdown-text";
import {
  AssistantMessageBody,
  ChatMessageRoot,
  ChatPending,
} from "@hutian-ai/design/chat/message";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@hutian-ai/design/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hutian-ai/design/ui/select";
import { Textarea } from "@hutian-ai/design/ui/textarea";
import type { ExecutionActivity } from "@hutian-world/contracts";
import { Copy } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { ChatExecution } from "../chat-execution";
export function AssistantMessage() {
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
