"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { MessageSquareText } from "lucide-react";
import { Button } from "@hutian-ai/design/ui/button";
import { Spinner } from "@hutian-ai/design/ui/spinner";
import { openRoleConversation } from "@/lib/communication-actions";

export function RoleChatButton({
  roleId,
  variant = "default",
}: {
  roleId: string;
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await openRoleConversation(roleId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(
        `/chat?${new URLSearchParams({ room: result.roomId, role: roleId })}`,
      );
      router.refresh();
    } catch {
      setError("私聊打开结果待核对，再次操作会回到原身份与房间。");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? <Spinner /> : <MessageSquareText />}
        {busy ? "正在进入…" : "发消息"}
      </Button>
      {error && (
        <small role="alert" className="max-w-xs text-destructive">
          {error}
        </small>
      )}
    </div>
  );
}
