import type { DeviceProvider } from "@harness-dock/client";
import { z } from "zod";

const inspectedModel = z.object({
  id: z.string(),
  efforts: z.array(z.string()).catch([]),
  serviceTiers: z.array(z.string()).catch([]),
});
const option = z.object({ value: z.string(), name: z.string() });
const optionGroup = z.object({ options: z.array(option) });
const modelSetting = z.object({
  id: z.string(),
  category: z.string().optional(),
  options: z.array(z.union([option, optionGroup])),
});
const inspectionData = z.object({
  models: z.array(z.unknown()).catch([]),
  configOptions: z.array(z.unknown()).catch([]),
  currentModelId: z.string().optional().catch(undefined),
});

export function runtimeModels(provider: Pick<DeviceProvider, "models" | "inspection">) {
  const { data } = inspectionData.safeParse(provider.inspection);
  const details = new Map<string, z.infer<typeof inspectedModel>>();
  for (const value of data?.models ?? []) {
    const parsed = inspectedModel.safeParse(value);
    if (parsed.success) details.set(parsed.data.id, parsed.data);
  }

  const names = new Map<string, string>();
  for (const value of data?.configOptions ?? []) {
    const parsed = modelSetting.safeParse(value);
    if (!parsed.success || (parsed.data.id !== "model" && parsed.data.category !== "model")) continue;
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
    current: data?.currentModelId === id,
  }));
}
