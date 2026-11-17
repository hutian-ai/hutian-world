import { z } from "zod";
import { actionFailure } from "../../common/errors/application-error.js";
import type { ApplicationServices } from "../application-services.js";
import { openDirectChat, sendDirectMessage } from "./direct-chat.js";
const peerId = z.string().regex(/^[a-z][a-z0-9-]{0,49}$/);
const message = z.string().trim().min(1).max(16000);
export async function openPrivateConversation(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  value: string,
) {
  try {
    await openDirectChat(app, peerId.parse(value));
    return { ok: true as const };
  } catch (error) {
    return actionFailure(error);
  }
}
export async function sendPrivateMessage(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  value: string,
  text: string,
  transactionId: string,
) {
  const parsed = message.safeParse(text);
  if (!parsed.success)
    return { ok: false as const, error: "请输入 1 到 16000 个字符的消息。" };
  try {
    const receipt = await sendDirectMessage(
      app,
      peerId.parse(value),
      parsed.data,
      z.uuid().parse(transactionId),
    );
    return { ok: true as const, eventId: receipt.eventId };
  } catch (error) {
    return actionFailure(error);
  }
}
