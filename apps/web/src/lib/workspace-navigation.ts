export const workspaceSections = [
  { href: "/inbox", label: "收件箱" },
  { href: "/chat", label: "沟通" },
  { href: "/members", label: "组织" },
  { href: "/knowledge", label: "知识库" },
  { href: "/memory", label: "记忆" },
  { href: "/schedules", label: "定时任务" },
  { href: "/runtimes", label: "运行环境" },
];

export function workspaceSection(pathname: string) {
  return [...workspaceSections, { href: "/projects", label: "项目" }].find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

/** Only an existing member page can be the origin of member-owned creation. */
export function memberReturnTo(value?: string) {
  return value && /^\/members\/[\da-f-]{36}(?:\?[^#]*)?$/.test(value)
    ? value
    : undefined;
}
