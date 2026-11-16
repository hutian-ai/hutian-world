import { command } from "./api";
export type * from "@hutian-world/contracts";
export const getDirectChat = command("direct-chat.getDirectChat");
export function chatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "暂时无法读取或保存私聊。";
}
