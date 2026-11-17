import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ApplicationError,
  actionFailure,
} from "../../common/errors/application-error.js";
import type { ApplicationServices } from "../application-services.js";
import { resourceScope } from "../resources/resource-scopes.js";
import { remember, saveKnowledge } from "../resources/resources.js";
import { communicationRequest } from "./communications.js";
export async function saveChatResult(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  input: unknown,
) {
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
      throw new ApplicationError("请选择个人工作台或当前会话范围。");
    const message = z
      .object({ id: z.string(), text: z.string() })
      .parse(
        await communicationRequest(
          app,
          `/api/message?${new URLSearchParams({ roomId: value.roomId, eventId: value.eventId })}`,
        ),
      );
    const sourceUri = `hutian://chat/${encodeURIComponent(value.roomId)}/${encodeURIComponent(message.id)}`;
    const version = createHash("sha256").update(message.text).digest("hex");
    const content = `${value.content}\n\n来源：${sourceUri}\n来源版本：${version}`;
    const result =
      value.kind === "memory"
        ? await remember(
            app,
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
            app,
            { id: value.id, title: value.title, content },
            value.scope,
          );
    return { ok: true as const, status: String(result.status ?? "unknown") };
  } catch (error) {
    return actionFailure(error);
  }
}
