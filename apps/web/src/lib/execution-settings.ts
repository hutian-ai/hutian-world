export type { RuntimeCapabilities } from "@hutian-world/contracts";
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

// Translate known native labels; available choices still come from the Runtime.
export const permissionLabel = (value: string) =>
  ({
    "Read-only": "只读",
    "Workspace access": "工作区访问",
    "Auto review": "自动审查",
    "Full access": "完全访问",
  })[value] ?? value;
