export function memberQuery(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 300) ?? "";
}

export function memberOwnerName(displayName: string) {
  const name = displayName.trim();
  return !name || name === "我的工作台" ? "我" : name;
}

export function memberHref(path: string, query: string, options: Record<string, string> = {}) {
  const params = new URLSearchParams(options);
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
