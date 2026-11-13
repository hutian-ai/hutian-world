import "server-only";
import { z } from "zod";

const agent = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string(),
  joined: z.boolean().optional(),
});
const room = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["direct", "group", "channel"]).default("group"),
});
export const directorySchema = z.object({
  rooms: z.array(room),
  agents: z.array(agent),
});
export const conversationSchema = z.object({
  room: z.object({ id: z.string(), name: z.string() }),
  members: z.array(
    z.object({ id: z.string(), name: z.string(), kind: z.string() }),
  ),
  agents: z.array(agent),
  messages: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      timestamp: z.number(),
      sender: z.string(),
      name: z.string(),
      agentId: z.string().nullable(),
      replyTo: z.string().nullable(),
    }),
  ),
  jobs: z.array(
    z.object({
      agentId: z.string(),
      eventId: z.string(),
      runId: z.string().nullable(),
      state: z.string(),
      error: z.string().nullable(),
    }),
  ),
  active: z
    .object({ agentId: z.string(), roomId: z.string(), eventId: z.string() })
    .nullable(),
});
export type ChatDirectory = z.infer<typeof directorySchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type RoomKind = z.infer<typeof room>["kind"];

export async function communicationRequest(path: string, body?: unknown) {
  const origin = new URL(
    process.env.HUTIAN_CHAT_URL ?? "http://127.0.0.1:3310",
  );
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1")
    throw new Error("通信地址必须是可信的本机宿主。");
  let response: Response;
  try {
    response = await fetch(origin.origin + path, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: origin.origin,
            },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new Error("通信服务暂时不可用，已保留会话，请稍后重新连接。");
  }
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "已有运行正在处理，先查看当前状态。"
        : "通信操作未确认，请刷新核对原消息与运行。",
    );
  return response.json() as Promise<unknown>;
}
export async function readDirectory() {
  return directorySchema.parse(await communicationRequest("/api/rooms"));
}
export async function readConversation(id: string) {
  z.string().startsWith("!").max(500).parse(id);
  // The communication host checks the operator's current Matrix membership on
  // every state read. Avoid re-reading every room on each polling request.
  return conversationSchema.parse(
    await communicationRequest(
      `/api/state?${new URLSearchParams({ roomId: id })}`,
    ),
  );
}
