import { command } from "./api";
export type * from "@hutian-world/contracts";
export const openPrivateConversation = command(
  "chat-actions.openPrivateConversation",
);
export const sendPrivateMessage = command("chat-actions.sendPrivateMessage");
