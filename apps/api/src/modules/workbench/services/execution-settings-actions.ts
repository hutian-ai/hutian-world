import { z } from "zod";
import { runtimeReference } from "@hutian-world/contracts";
import { getDockDevice } from "./dock.js";
import type { RuntimeCapabilities } from "./execution-settings.js";

export async function readRuntimeCapabilities(input: unknown) {
  try {
    const runtime = runtimeReference.parse(input);
    const device = await getDockDevice(runtime.nodeId);
    if (device.state !== "online")
      throw new Error("所选电脑离线或状态尚未确认，原选择已保留。");
    const harness = device.runtimes.find(
      (r) => r.key === runtime.provider && r.status === "ready",
    );
    if (!harness) throw new Error("所选 Harness 当前不可用，请重新读取。");
    const capabilities: RuntimeCapabilities = {
      label: `${device.device.label || device.device.nodeId} · ${harness.displayName}`,
      models: harness.models,
      current: harness.defaults,
      permissionModes: harness.permissionModes,
    };
    return { ok: true as const, capabilities };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof z.ZodError
          ? "运行环境标识未确认，请重新读取成员配置。"
          : error instanceof Error
            ? error.message
            : "运行配置暂不可读取。",
    };
  }
}
