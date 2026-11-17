import { runtimeDisplayLabel } from "@hutian-world/contracts";
import type { ApplicationServices } from "../application-services.js";
import { getDockConnection } from "../runtimes/dock.js";
export type RoleRuntimeChoice = {
  nodeId: string;
  provider: string;
  label: string;
};
export function memberRuntimeLabel(
  machine: {
    nodeId: string;
    customName?: string | null;
    platform?: string;
  },
  harness: string,
) {
  return runtimeDisplayLabel(machine.nodeId, harness, machine.customName);
}
export async function roleRuntimeChoices(
  app: Pick<ApplicationServices, "contexts" | "devices">,
): Promise<{
  choices: RoleRuntimeChoice[];
  error: string;
}> {
  const connection = await getDockConnection(app);
  if (connection.state !== "connected")
    return {
      choices: [],
      error:
        connection.state === "error"
          ? connection.message
          : "请先在运行环境中连接 Dock Server。",
    };
  return {
    choices: connection.devices.flatMap((device) =>
      device.runtimes
        .filter((r) => r.status === "ready")
        .map((runtime) => ({
          nodeId: device.nodeId,
          provider: runtime.key,
          label: memberRuntimeLabel(device, runtime.displayName),
        })),
    ),
    error: "",
  };
}
