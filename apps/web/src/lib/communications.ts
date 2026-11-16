import { command } from "./api";
export type * from "@hutian-world/contracts";
export const readDirectory = command("communications.readDirectory");
export const readConversation = command("communications.readConversation");
