import { command } from "./api";
export type * from "@hutian-world/contracts";
export const loadResources = command("resources.loadResources");
export const saveResource = command("resources.saveResource");
export const findResources = command("resources.findResources");
export const readMemorySource = command("resources.readMemorySource");
export const observeMemory = command("resources.observeMemory");

export const readKnowledgeSource = command("resources.readKnowledgeSource");
