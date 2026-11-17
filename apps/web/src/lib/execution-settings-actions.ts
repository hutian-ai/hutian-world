import { command } from "./api";
export type * from "@hutian-world/contracts";
export const readRuntimeCapabilities = command(
  "runtimes.readRuntimeCapabilities",
);
