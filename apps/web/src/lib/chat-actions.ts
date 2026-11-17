import { command } from "./api";
export type * from "@hutian-world/contracts";
export const openPrivateConversation = command("conversations.openPrivate");
export const sendPrivateMessage = command("conversations.sendPrivate");
