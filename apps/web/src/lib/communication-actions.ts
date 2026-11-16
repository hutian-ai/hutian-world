import { command } from "./api";
export type * from "@hutian-world/contracts";
export const refreshConversation = command(
  "communication-actions.refreshConversation",
);
export const createCommunication = command(
  "communication-actions.createCommunication",
);
export const openRoleConversation = command(
  "communication-actions.openRoleConversation",
);
export const postConversation = command(
  "communication-actions.postConversation",
);
export const askConversation = command("communication-actions.askConversation");
export const discoverChatRuntimes = command(
  "communication-actions.discoverChatRuntimes",
);
export const controlConversation = command(
  "communication-actions.controlConversation",
);
export const controlConversationQueue = command(
  "communication-actions.controlConversationQueue",
);
export const retrieveConversationOutputs = command(
  "communication-actions.retrieveConversationOutputs",
);
export const handoffConversation = command(
  "communication-actions.handoffConversation",
);
export const inviteConversation = command(
  "communication-actions.inviteConversation",
);
