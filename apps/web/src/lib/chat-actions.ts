"use server";

import { z } from "zod";
import { chatErrorMessage, openDirectChat, sendDirectMessage } from "./direct-chat";

const peerId = z.string().regex(/^[a-z][a-z0-9-]{0,49}$/);
const message = z.string().trim().min(1).max(16_000);

export async function openPrivateConversation(value: string) {
  try {
    await openDirectChat(peerId.parse(value));
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: chatErrorMessage(error) };
  }
}

export async function sendPrivateMessage(value: string, text: string, transactionId: string) {
  const parsed = message.safeParse(text);
  if (!parsed.success) return { ok: false as const, error: "请输入 1 到 16000 个字符的消息。" };
  try {
    const receipt = await sendDirectMessage(peerId.parse(value), parsed.data, z.uuid().parse(transactionId));
    return { ok: true as const, eventId: receipt.eventId };
  } catch (error) {
    return { ok: false as const, error: chatErrorMessage(error) };
  }
}
