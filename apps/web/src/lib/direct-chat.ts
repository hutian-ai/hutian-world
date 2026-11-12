import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { getWorkspace } from "./api";

const peerSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,49}$/),
  userId: z.string().regex(/^@[^:]+:.+$/),
  name: z.string(),
  description: z.string(),
});
const roomSchema = z.object({ room: z.object({ id: z.string().startsWith("!") }) });
const directorySchema = z.object({ agents: z.array(peerSchema) });
const stateSchema = z.object({
  members: z.array(z.object({ id: z.string(), kind: z.string() })),
  messages: z.array(z.object({
    id: z.string(), text: z.string(), timestamp: z.number(),
    sender: z.string(), name: z.string(), replyTo: z.string().nullable(),
  })),
});
export type ChatPeer = z.infer<typeof peerSchema>;
export type ChatMessage = z.infer<typeof stateSchema>["messages"][number];
export type ChatEntry = { peer: ChatPeer; exists: boolean };

export class ChatError extends Error {}

function localOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.href !== `${url.origin}/`) {
    throw new ChatError("本机私聊服务地址配置有误。");
  }
  return url.origin;
}

async function request(origin: string, path: string, body?: object) {
  try {
    return await fetch(`${origin}${path}`, {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000),
      ...(body && { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new ChatError("本机通信服务暂时不可用，请刷新后再试。");
  }
}

function chatOrigin() {
  return localOrigin(process.env.HUTIAN_CHAT_URL ?? "http://127.0.0.1:3310");
}

async function chatRequest(path: string, body?: object) {
  const response = await request(chatOrigin(), path, body);
  if (!response.ok) throw new ChatError("通信服务未确认此操作，请刷新后核对私聊状态。");
  return response.json() as Promise<unknown>;
}

async function peers() {
  const directory = directorySchema.parse(await chatRequest("/api/rooms"));
  return directory.agents;
}

function roomTransaction(creatorId: string, userId: string) {
  const hash = createHash("sha256").update(`hutian-world:direct:${creatorId}:${userId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function resolveRoom(creatorId: string, peer: ChatPeer) {
  const serverName = peer.userId.slice(peer.userId.indexOf(":") + 1);
  const alias = `#web-${roomTransaction(creatorId, peer.userId)}:${serverName}`;
  const origin = localOrigin(process.env.HUTIAN_MATRIX_URL ?? "http://127.0.0.1:8008");
  const result = await request(origin, `/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`);
  if (result.status === 404) return null;
  if (!result.ok) throw new ChatError("无法读取私聊目录，请稍后重试。");
  return z.object({ room_id: z.string().startsWith("!") }).parse(await result.json()).room_id;
}

async function readDirectRoom(roomId: string, peer: ChatPeer) {
  const state = stateSchema.parse(await chatRequest(`/api/state?${new URLSearchParams({ roomId })}`));
  if (state.members.length !== 2 || !state.members.some((member) => member.kind === "human")
    || !state.members.some((member) => member.kind === "agent" && member.id === peer.userId)) {
    throw new ChatError("会话成员有变更，无法在私聊中读取或发送消息。");
  }
  return state.messages.filter((message) => message.sender === "human" || message.sender === "agent");
}

export async function getDirectChat(selectedId?: string) {
  const [{ creator }, agents] = await Promise.all([getWorkspace(), peers()]);
  const rooms = await Promise.all(agents.map(async (peer) => ({ peer, roomId: await resolveRoom(creator.id, peer) })));
  const selected = rooms.find(({ peer }) => peer.id === selectedId);
  const directory = rooms.map(({ peer, roomId }) => ({ peer, exists: roomId !== null }));
  if (!selected?.roomId) return { directory, selected: undefined, messages: [], error: selectedId ? "该私聊尚未建立或已不可用。" : undefined };
  try {
    return { directory, selected: selected.peer, messages: await readDirectRoom(selected.roomId, selected.peer), error: undefined };
  } catch (error) {
    return { directory, selected: selected.peer, messages: [], error: chatErrorMessage(error) };
  }
}

async function findPeer(peerId: string) {
  const [{ creator }, agents] = await Promise.all([getWorkspace(), peers()]);
  const peer = agents.find((agent) => agent.id === peerId);
  if (!peer) throw new ChatError("这位聊天对象已不可用。");
  return { creatorId: creator.id, peer };
}

export async function openDirectChat(peerId: string) {
  const { creatorId, peer } = await findPeer(peerId);
  const existing = await resolveRoom(creatorId, peer);
  if (existing) {
    try {
      await readDirectRoom(existing, peer);
      return;
    } catch (error) {
      // An interrupted creation can leave the operator alone in the reserved room.
      // Only resume that case, and never change a room with another member.
      const { members } = stateSchema.parse(await chatRequest(`/api/state?${new URLSearchParams({ roomId: existing })}`));
      if (members.length !== 1 || members[0].kind !== "human") throw error;
    }
  }
  const transactionId = roomTransaction(creatorId, peer.userId);
  const result = roomSchema.parse(await chatRequest("/api/rooms", {
    name: `私聊 · ${peer.name}`.slice(0, 80), transactionId, agentIds: [peer.id],
  }));
  await readDirectRoom(result.room.id, peer);
}

export async function sendDirectMessage(peerId: string, text: string, transactionId: string) {
  const { creatorId, peer } = await findPeer(peerId);
  const roomId = await resolveRoom(creatorId, peer);
  if (!roomId) throw new ChatError("请先建立私聊会话。");
  await readDirectRoom(roomId, peer);
  const receipt = await chatRequest("/api/messages", { roomId, text, transactionId });
  return z.object({ eventId: z.string().startsWith("$") }).parse(receipt);
}

export function chatErrorMessage(error: unknown) {
  return error instanceof ChatError ? error.message : "暂时无法读取或保存私聊，请刷新后核对。";
}
