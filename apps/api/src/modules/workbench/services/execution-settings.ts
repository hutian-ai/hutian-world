import type { ExecutionPreferences } from "@hutian-world/contracts";
import type { runtimeModels } from "./runtime-models.js";

export type RuntimeCapabilities = {
  label: string;
  models: ReturnType<typeof runtimeModels>;
  current: ExecutionPreferences;
  permissionModes: { id: string; name: string }[];
};
export const effortLabel = (value: string) =>
  ({
    minimal: "最低",
    low: "低",
    medium: "中",
    high: "高",
    xhigh: "很高",
    max: "最高",
    ultra: "极高",
  })[value] ?? value;
export function validateExecution(
  preferences: ExecutionPreferences,
  capabilities: RuntimeCapabilities,
) {
  if (preferences.serviceTier)
    throw new Error("此版本暂不开放服务档位修改；可在运行环境中查看原生能力。");
  if (
    preferences.mode &&
    !capabilities.permissionModes.some((mode) => mode.id === preferences.mode)
  )
    throw new Error("所选执行权限当前不受该 Runtime 支持，请重新选择。");
  const modelId = preferences.model ?? capabilities.current.model;
  const model = capabilities.models.find((m) => m.id === modelId);
  if (preferences.model && !model)
    throw new Error("所选模型当前不受该 Runtime 支持，请重新选择。");
  if (preferences.effort && !model?.efforts.includes(preferences.effort))
    throw new Error("所选模型不支持这个推理等级，请重新选择。");
  if (
    preferences.serviceTier &&
    !model?.serviceTiers.includes(preferences.serviceTier)
  )
    throw new Error("所选模型不支持这个服务档位，请重新选择。");
  // Dock validates reasoning against an explicit model. Pin the observed native
  // model when the user requests reasoning while following the native model.
  return {
    ...(preferences.model || preferences.effort || preferences.serviceTier
      ? { model: modelId }
      : {}),
    ...(preferences.effort || preferences.serviceTier || preferences.mode
      ? {
          config: {
            ...(preferences.mode ? { mode: preferences.mode } : {}),
            ...(preferences.effort ? { effort: preferences.effort } : {}),
            ...(preferences.serviceTier
              ? { serviceTier: preferences.serviceTier }
              : {}),
          },
        }
      : {}),
  };
}
