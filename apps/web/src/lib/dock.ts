import { command } from "./api";
export type * from "@hutian-world/contracts";
export const getDockConnection = command("runtimes.connection");
export const getDockDevice = command("runtimes.device");

export const saveRuntimeDeviceName = command("runtimes.renameDevice");
