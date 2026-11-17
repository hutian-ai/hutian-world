"use client";
import { controlConversationQueue } from "@/lib/communication-actions";
import type { Conversation } from "@/lib/communications";
import Link from "@/lib/navigation";
import { MessagePrimitive, useAuiState } from "@assistant-ui/react";
import {
  ChatMessageRoot,
  UserMessageBubble,
} from "@hutian-ai/design/chat/message";
import { Button } from "@hutian-ai/design/ui/button";
import { useState } from "react";
import { ChatMessageText } from "../chat-mentions";
export function UserMessage() {
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
        <MessagePrimitive.Parts components={{ Text: ChatMessageText }} />
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
