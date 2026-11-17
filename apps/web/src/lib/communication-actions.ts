import { command } from "./api";
export type * from "@hutian-world/contracts";
export const refreshConversation = command("conversations.refreshConversation");
export const createCommunication = command("conversations.createCommunication");
export const openRoleConversation = command(
  "conversations.openRoleConversation",
);
export const postConversation = command("conversations.postConversation");
export const askConversation = command("conversations.askConversation");
export const discoverChatRuntimes = command(
  "conversations.discoverChatRuntimes",
);
export const controlConversation = command("conversations.controlConversation");
export const controlConversationQueue = command(
  "conversations.controlConversationQueue",
);
export const retrieveConversationOutputs = command(
  "conversations.retrieveConversationOutputs",
);
export const handoffConversation = command("conversations.handoffConversation");
export const inviteConversation = command("conversations.inviteConversation");
