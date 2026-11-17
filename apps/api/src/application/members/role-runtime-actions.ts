import {
  executionPreferences,
  runtimeReference,
} from "@hutian-world/contracts";
import { z } from "zod";
import {
  actionFailure,
  ApiError,
} from "../../common/errors/application-error.js";
import type { ApplicationServices } from "../application-services.js";
import { getDockDevice } from "../runtimes/dock.js";
import { validateExecution } from "../runtimes/execution-settings.js";
import { memberRuntimeLabel } from "./role-runtime.js";
export async function setMemberRuntime(
  app: Pick<ApplicationServices, "contexts" | "devices" | "roles">,
  id: string,
  input: unknown,
  expected: unknown,
) {
  const roleId = z.uuid().parse(id);
  const runtime = runtimeReference
    .extend({ preferences: executionPreferences.default({}) })
    .nullable()
    .parse(input);
  const expectedUpdatedAt = z.string().datetime().nullable().parse(expected);
  if (!(await app.roles.list()).some((role) => role.id === roleId))
    throw new ApiError("成员不存在或不可访问。", 40400, 404);
  let label = "";
  if (runtime) {
    const device = await getDockDevice(app, runtime.nodeId);
    if (device.state !== "online")
      throw new ApiError(
        "暂时无法确认这台电脑可用，设置未保存。",
        50300,
        503,
        "retry",
      );
    const harness = device.runtimes.find(
      (r) => r.key === runtime.provider && r.status === "ready",
    );
    if (!harness)
      throw new ApiError(
        "所选 Harness 当前不可用，设置未保存。",
        50300,
        503,
        "retry",
      );
    label = memberRuntimeLabel(
      { ...device.device, platform: device.platform.platform },
      harness.displayName,
    );
    validateExecution(runtime.preferences, {
      label,
      models: harness.models,
      current: harness.defaults,
      permissionModes: harness.permissionModes,
    });
  }
  return app.roles.setRoleRuntime(roleId, {
    runtime: runtime ? { ...runtime, label } : null,
    expectedUpdatedAt,
  });
}
export async function saveRoleRuntime(
  app: Pick<ApplicationServices, "contexts" | "devices" | "roles">,
  id: string,
  input: unknown,
  expected: unknown,
) {
  try {
    const saved = await setMemberRuntime(app, id, input, expected);
    return { ok: true as const, binding: saved.binding };
  } catch (error) {
    return actionFailure(error);
  }
}
