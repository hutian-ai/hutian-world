"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runtimeReference } from "@hutian-world/contracts";
import { api, ApiError, getWorkspace } from "./api";
import { getDockDevice } from "./dock";
import { memberRuntimeLabel } from "./role-runtime";

export async function saveRoleRuntime(id: string, input: unknown, expected: unknown) {
  try {
    const roleId = z.uuid().parse(id);
    const runtime = runtimeReference.nullable().parse(input);
    const expectedUpdatedAt = z.string().datetime().nullable().parse(expected);
    if (!(await getWorkspace()).roles.some(role => role.id === roleId)) throw new ApiError("成员不存在或不可访问。");
    let label = "";
    if (runtime) {
      const device = await getDockDevice(runtime.nodeId);
      if (device.state !== "online") throw new ApiError("暂时无法确认这台电脑可用，设置未保存，请稍后重新读取。");
      const harness = device.runtimes.find(r => r.key === runtime.provider && r.status === "ready");
      if (!harness) throw new ApiError("所选 Harness 当前不可用，设置未保存。");
      label = memberRuntimeLabel({ ...device.device, platform: device.platform.platform }, harness.displayName);
    }
    await api(`/v1/roles/${roleId}/runtime`, "PUT", { runtime: runtime ? { ...runtime, label } : null, expectedUpdatedAt });
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof z.ZodError ? "请选择有效的 Runtime。" : error instanceof ApiError ? error.message : "保存结果待核对，请刷新成员配置后确认。" };
  }
}
