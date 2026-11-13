import type { DockDevice } from "@/lib/dock";

export function deviceLabel(device: DockDevice) {
  return device.nodeId;
}

const runtimeStatuses: Record<string, string> = {
  ready: "可用",
  not_found: "未安装",
  disabled: "已停用",
  unavailable: "不可用",
};

export function runtimeStatus(value: string) {
  return { value, label: runtimeStatuses[value] ?? "未知" };
}

export function deviceStatus(connected: boolean) {
  return connected
    ? { value: "connected", label: "在线" }
    : { value: "unavailable", label: "离线" };
}
