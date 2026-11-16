import { createHash } from "node:crypto";
import { z } from "zod";
import { communicationRequest } from "./communications.js";
import { resourceScope } from "./resource-scopes.js";
import { remember, saveKnowledge } from "./resources.js";

export async function saveChatResult(input: unknown) {
  try {
    const value = z
      .object({
        id: z.uuid(),
        roomId: z.string().startsWith("!").max(500),
        eventId: z.string().startsWith("$").max(500),
        kind: z.enum(["memory", "knowledge"]),
        title: z.string().trim().min(1).max(80),
        content: z.string().trim().min(1).max(18000),
        scope: resourceScope,
      })
      .strict()
      .parse(input);
    if (
      value.scope.kind !== "workspace" &&
      (value.scope.kind !== "conversation" || value.scope.id !== value.roomId)
    )
      throw new Error("请选择个人工作台或当前会话范围。");
    const message = z
      .object({ id: z.string(), text: z.string() })
      .parse(
        await communicationRequest(
          `/api/message?${new URLSearchParams({ roomId: value.roomId, eventId: value.eventId })}`,
        ),
      );
    const sourceUri = `hutian://chat/${encodeURIComponent(value.roomId)}/${encodeURIComponent(message.id)}`;
    const version = createHash("sha256").update(message.text).digest("hex");
    const content = `${value.content}\n\n来源：${sourceUri}\n来源版本：${version}`;
    const result =
      value.kind === "memory"
        ? await remember(
            {
              id: value.id,
              title: value.title,
              content,
              sourceUri,
              sourceVersion: version,
            },
            value.scope,
          )
        : await saveKnowledge(
            { id: value.id, title: value.title, content },
            value.scope,
          );
    return { ok: true as const, status: String(result.status ?? "unknown") };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "保存未确认，请核对原保存操作。",
    };
  }
}
