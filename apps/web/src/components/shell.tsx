"use client";

import { Image } from "@/lib/navigation";
import Link from "@/lib/navigation";
import { usePathname } from "@/lib/navigation";
import {
  BookOpen,
  Brain,
  CalendarClock,
  Inbox,
  ChevronRight,
  MessageCircle,
  ServerCog,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { loadInbox } from "@/lib/inbox";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@hutian-ai/design/ui/sidebar";
import { Avatar, AvatarFallback } from "@hutian-ai/design/ui/avatar";

const navigation = [
  { href: "/inbox", label: "收件箱", icon: Inbox },
  { href: "/chat", label: "沟通", icon: MessageCircle },
  { href: "/members", label: "组织", icon: UsersRound },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/memory", label: "记忆", icon: Brain },
  { href: "/schedules", label: "定时任务", icon: CalendarClock },
  { href: "/runtimes", label: "运行环境", icon: ServerCog },
];

function WorkspaceNavigation() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    let current = true;
    const refresh = async () => {
      try {
        const data = await loadInbox("unread");
        if (!current) return;
        setUnread(data.unread);
        const keys = new Set(data.notices.map((n) => `${n.id}:${n.updatedAt}`));
        if (seen.current && !location.pathname.startsWith("/inbox")) {
          const latest = data.notices.find(
            (n) => !seen.current!.has(`${n.id}:${n.updatedAt}`),
          );
          if (latest)
            toast(latest.run.snapshot.title, {
              description:
                latest.run.state === "waiting_permission"
                  ? "需要你授权，请到收件箱处理。"
                  : latest.run.state === "failed"
                    ? "本次执行失败，原因已记录。"
                    : latest.kind === "result"
                      ? "新结果已到达收件箱。"
                      : "有一项工作需要你查看。",
              action: {
                label: "查看",
                onClick: () => {
                  location.href = `/inbox?run=${latest.id}`;
                },
              },
            });
        }
        seen.current ??= new Set();
        for (const key of keys) seen.current.add(key);
      } catch {
        /* The inbox page provides the explicit retry/error view. */
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    window.addEventListener("hutian:inbox", refresh);
    return () => {
      current = false;
      clearInterval(timer);
      window.removeEventListener("hutian:inbox", refresh);
    };
  }, []);
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup className="px-2 pt-3">
      <SidebarGroupLabel>世界工作</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={label}
                  className="h-9 rounded-md border-l-2 border-transparent px-3 text-muted-foreground data-[active=true]:border-primary data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground"
                >
                  <Link
                    href={href}
                    prefetch={href === "/runtimes" ? false : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpenMobile(false)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                    {href === "/inbox" && unread > 0 && (
                      <span
                        className="ml-auto text-xs tabular-nums"
                        aria-label={`${unread} 条未读`}
                      >
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function WorkspaceShell({
  owner,
  defaultSidebarOpen,
  children,
}: {
  owner: string;
  defaultSidebarOpen: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const section = navigation.find(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );
  return (
    <SidebarProvider
      defaultOpen={defaultSidebarOpen}
      style={{ "--sidebar-width": "13rem" } as React.CSSProperties}
    >
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="gap-3 border-b p-3 group-data-[collapsible=icon]:p-2">
          <Link
            href="/chat"
            aria-label="hutian 世界管理台"
            className="flex h-9 items-center gap-3 overflow-hidden rounded-md px-1 focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <Image
              src="/brand/hutian-mark.png"
              width={32}
              height={32}
              alt=""
              priority
              className="size-8 shrink-0 rounded-md object-contain"
            />
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <strong className="block text-[15px] tracking-[-0.01em]">
                hutian
              </strong>
              <small className="block text-[10px] text-muted-foreground">
                世界管理台
              </small>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent role="navigation" aria-label="世界功能">
          <WorkspaceNavigation />
        </SidebarContent>
        <SidebarFooter className="border-t p-3">
          <div
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
            aria-label="当前创造者"
          >
            <Avatar className="size-6 rounded-md">
              <AvatarFallback className="rounded-md text-[10px]">
                我
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              {owner}
            </span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <nav
            aria-label="当前位置"
            className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span className="truncate">{owner}</span>
            {section && (
              <>
                <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                <Link href={section.href}>{section.label}</Link>
              </>
            )}
          </nav>
        </header>
        <div id="main-content" className="world-content" tabIndex={-1}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
