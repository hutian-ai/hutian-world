import { getDockConnection } from "./dock.js";

export type RoleRuntimeChoice = {
  nodeId: string;
  provider: string;
  label: string;
};

export function memberRuntimeLabel(
  machine: { nodeId: string; label?: string; platform?: string },
  harness: string,
) {
  const platform = (
    { darwin: "macOS", win32: "Windows", linux: "Linux" } as Record<
      string,
      string
    >
  )[machine.platform ?? ""];
  const name = machine.label?.trim() || machine.nodeId;
  return [platform, name === platform ? "" : name, harness]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200);
}

export async function roleRuntimeChoices(): Promise<{
  choices: RoleRuntimeChoice[];
  error: string;
}> {
  const connection = await getDockConnection();
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
