import { runtimeReference } from "@hutian-world/contracts";
import {
  ApplicationError,
  actionFailure,
} from "../../common/errors/application-error.js";
import type { ApplicationServices } from "../application-services.js";
import { getDockDevice } from "./dock.js";
import type { RuntimeCapabilities } from "./execution-settings.js";
export async function readRuntimeCapabilities(
  app: Pick<ApplicationServices, "contexts" | "devices">,
  input: unknown,
) {
  try {
    const runtime = runtimeReference.parse(input);
    const device = await getDockDevice(app, runtime.nodeId);
    if (device.state !== "online")
      throw new ApplicationError("所选电脑离线或状态尚未确认，原选择已保留。");
    const harness = device.runtimes.find(
      (r) => r.key === runtime.provider && r.status === "ready",
    );
    if (!harness)
      throw new ApplicationError("所选 Harness 当前不可用，请重新读取。");
    const capabilities: RuntimeCapabilities = {
      label: `${device.device.customName || device.device.nodeId} · ${harness.displayName}`,
      models: harness.models,
      current: harness.defaults,
      permissionModes: harness.permissionModes,
    };
    return { ok: true as const, capabilities };
  } catch (error) {
    return actionFailure(error);
  }
}
