import { command, api } from "./api";
import {
  runtimeOverviewSchema,
  type RuntimeOverviewInput,
} from "@hutian-world/contracts";
export type * from "@hutian-world/contracts";
export const getDockConnection = command("runtimes.connection");
export const getDockDevice = command("runtimes.device");

export const saveRuntimeDeviceName = command("runtimes.renameDevice");

export async function getRuntimeOverview(input: RuntimeOverviewInput) {
  return runtimeOverviewSchema.parse(
    await api("/v2/commands/runtimes.overview", "POST", [input]),
  );
}
