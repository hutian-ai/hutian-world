import { command } from "./api";
export type * from "@hutian-world/contracts";
export const loadResources = command("resource-actions.loadResources");
export const saveResource = command("resource-actions.saveResource");
export const findResources = command("resource-actions.findResources");
export const readMemorySource = command("resource-actions.readMemorySource");
export const observeMemory = command("resource-actions.observeMemory");
