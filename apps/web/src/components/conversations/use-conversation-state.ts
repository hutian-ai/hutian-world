import { refreshConversation } from "@/lib/communication-actions";
import type { Conversation } from "@/lib/communications";
import {
  conversationSchema,
  executionActivitySchema,
} from "@hutian-world/contracts";
import { useEffect, useRef, useState } from "react";
import { mergeConversation } from "./conversation-state";
export function useConversationState(
  initial: Conversation | null,
  selectedId?: string,
) {
  const [state, setState] = useState(initial);
  const [historyCursor, setHistoryCursor] = useState(
    initial?.nextCursor ?? null,
  );
  const [historyError, setHistoryError] = useState("");

  const [connectionError, setConnectionError] = useState("");
  const current = useRef(selectedId);
  current.current = selectedId;
  const initialRoom = useRef(initial?.room.id);
  useEffect(() => {
    if (initialRoom.current !== initial?.room.id) {
      setState(initial);
      setHistoryCursor(initial?.nextCursor ?? null);
      setHistoryError("");
      initialRoom.current = initial?.room.id;
    } else if (initial)
      setState((previous) => mergeConversation(previous, initial));
  }, [initial, selectedId]);
  async function refresh() {
    if (!selectedId) return;
    const r = await refreshConversation(selectedId);
    if (current.current !== selectedId) return false;
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
          if (current.current !== selectedId) return;
          const snapshot = conversationSchema.parse(JSON.parse(event.data));
          setState((previous) => mergeConversation(previous, snapshot));
          setConnectionError("");
        } catch {
          setConnectionError("会话状态暂未确认，请刷新核对。");
        }
      };
      events.addEventListener("activity", (event) => {
        try {
          if (current.current !== selectedId) return;
          const payload = JSON.parse((event as MessageEvent).data);
          if (!payload.activity) return;
          const activity = executionActivitySchema.parse(payload.activity);
          const update = { runId: activity.runId, activity };
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

  return {
    state,
    setState,
    historyCursor,
    setHistoryCursor,
    historyError,
    setHistoryError,
    connectionError,
    refresh,
  };
}
