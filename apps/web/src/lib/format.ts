export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", timeZone: "Asia/Shanghai" }).format(new Date(value));
}
