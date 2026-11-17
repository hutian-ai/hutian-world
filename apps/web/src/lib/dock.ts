import { command } from "./api";
export type * from "@hutian-world/contracts";
export const getDockConnection = command("dock.getDockConnection");
export const getDockDevice = command("dock.getDockDevice");

export const saveRuntimeDeviceName = command("dock.saveRuntimeDeviceName");
