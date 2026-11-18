import type { DeviceProvider } from "@harness-dock/client";
import { z } from "zod";
const inspectedModel = z.object({
  id: z.string(),
  efforts: z.array(z.string()).catch([]),
  serviceTiers: z.array(z.string()).optional(),
});
const option = z.object({ value: z.string(), name: z.string() });
const optionGroup = z.object({ options: z.array(option) });
const modelSetting = z.object({
  id: z.string(),
  currentValue: z.string().optional(),
  category: z.string().optional(),
  options: z.array(z.union([option, optionGroup])),
});
const inspectionData = z.object({
  models: z.array(z.unknown()).catch([]),
  configOptions: z.array(z.unknown()).catch([]),
  currentModelId: z.string().optional().catch(undefined),
});
export function runtimeModels(
  provider: Pick<DeviceProvider, "models" | "inspection">,
) {
  const { data } = inspectionData.safeParse(provider.inspection);
  const details = new Map<string, z.infer<typeof inspectedModel>>();
  for (const value of data?.models ?? []) {
    const parsed = inspectedModel.safeParse(value);
    if (parsed.success) details.set(parsed.data.id, parsed.data);
  }
  const names = new Map<string, string>();
  let currentModelId = data?.currentModelId;
  for (const value of data?.configOptions ?? []) {
    const parsed = modelSetting.safeParse(value);
    if (
      !parsed.success ||
      (parsed.data.id !== "model" && parsed.data.category !== "model")
    )
      continue;
    currentModelId ??= parsed.data.currentValue;
    for (const entry of parsed.data.options) {
      const choices = "options" in entry ? entry.options : [entry];
      for (const choice of choices) names.set(choice.value, choice.name);
    }
  }
  return [...new Set(provider.models)].map((id) => ({
    id,
    name: names.get(id)?.trim() || id,
    efforts: details.get(id)?.efforts ?? [],
    serviceTiers: details.get(id)?.serviceTiers ?? [],
    current: currentModelId === id,
    fastModeSupport:
      details.get(id)?.serviceTiers === undefined
        ? ("unreported" as const)
        : details.get(id)!.serviceTiers!.includes("priority")
          ? ("supported" as const)
          : ("unsupported" as const),
  }));
}
export function runtimeDefaults(
  provider: Pick<DeviceProvider, "models" | "inspection">,
) {
  const data = z
    .object({
      currentModelId: z.string().optional(),
      configOptions: z
        .array(z.object({ id: z.string(), currentValue: z.unknown() }))
        .catch([]),
    })
    .safeParse(provider.inspection).data;
  const value = (id: string) => {
    const current = data?.configOptions.find((o) => o.id === id)?.currentValue;
    return typeof current === "string" ? current : undefined;
  };
  return {
    model: data?.currentModelId ?? value("model"),
    effort: value("reasoning_effort"),
    mode: runtimePermissions(provider).current,
    serviceTier: value("fast-mode") === "on" ? "priority" : undefined,
  };
}
/** Select only modes reported by this native Harness. IDs remain opaque. */
export function runtimePermissions(
  provider: Pick<DeviceProvider, "inspection">,
) {
  const data = z
    .object({
      permissionModes: z.array(option).optional(),
      defaultPermissionMode: z.string().nullish(),
      configOptions: z.array(z.unknown()).catch([]),
    })
    .safeParse(provider.inspection).data;
  const native = data?.configOptions.flatMap((value) => {
    const parsed = modelSetting
      .extend({ type: z.literal("select") })
      .safeParse(value);
    return parsed.success &&
      (parsed.data.id === "mode" || parsed.data.category === "mode")
      ? [parsed.data]
      : [];
  })[0];
  const choices =
    data?.permissionModes ??
    native?.options.flatMap((entry) =>
      "options" in entry ? entry.options : [entry],
    ) ??
    [];
  const modes = choices
    .filter(
      (entry, index) =>
        entry.value.trim() &&
        choices.findIndex((other) => other.value === entry.value) === index,
    )
    .map((entry) => ({ id: entry.value, name: entry.name }));
  const current = data?.defaultPermissionMode ?? native?.currentValue;
  return {
    modes,
    current: modes.some((mode) => mode.id === current) ? current : undefined,
  };
}
