import { command } from "./api";
export type * from "@hutian-world/contracts";
export const readRuntimeCapabilities = command(
  "execution-settings-actions.readRuntimeCapabilities",
);
