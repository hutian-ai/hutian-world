"use client";
import { type AssistantRuntime } from "@assistant-ui/react";
import { useEffect } from "react";
export function ComposerDraft({
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
    } catch {
      /* Local observer cleanup can race with disconnection. */
    }
    onText(runtime.thread.composer.getState().text);
    return runtime.thread.composer.subscribe(() => {
      onText(runtime.thread.composer.getState().text);
      try {
        localStorage.setItem(key, runtime.thread.composer.getState().text);
      } catch {
        /* Local observer cleanup can race with disconnection. */
      }
    });
  }, [roomId, runtime, onText]);
  return null;
}
