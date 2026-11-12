"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, ChevronRight, MessageCircle, ServerCog, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navigation = [
  { href: "/chat", label: "私聊", icon: MessageCircle },
  { href: "/members", label: "组织", icon: UsersRound },
  { href: "/projects", label: "项目", icon: BriefcaseBusiness },
  { href: "/runtimes", label: "运行环境", icon: ServerCog },
];

function WorkspaceNavigation() {
  const pathname = usePathname();
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
                <SidebarMenuButton asChild isActive={active} tooltip={label}
                  className="h-9 rounded-md border-l-2 border-transparent px-3 text-muted-foreground data-[active=true]:border-primary data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground">
                  <Link href={href} prefetch={href === "/runtimes" ? false : undefined} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
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

export function WorkspaceShell({ owner, defaultSidebarOpen, children }: {
  owner: string;
  defaultSidebarOpen: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const section = navigation.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} style={{ "--sidebar-width": "13rem" } as React.CSSProperties}>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="gap-3 border-b p-3 group-data-[collapsible=icon]:p-2">
          <Link href="/chat" aria-label="hutian 世界管理台"
            className="flex h-9 items-center gap-3 overflow-hidden rounded-md px-1 focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <Image src="/brand/hutian-mark.png" width={32} height={32} alt="" priority className="size-8 shrink-0 rounded-md object-contain" />
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <strong className="block text-[15px] tracking-[-0.01em]">hutian</strong>
              <small className="block text-[10px] text-muted-foreground">世界管理台</small>
            </span>
          </Link>
          <div className="flex h-10 items-center gap-2.5 rounded-md border border-sidebar-border px-2 group-data-[collapsible=icon]:hidden">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border bg-primary/10 text-xs text-primary">世</span>
            <span className="min-w-0">
              <small className="block text-[9px] text-muted-foreground">当前世界</small>
              <strong className="block truncate text-xs">{owner}</strong>
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent role="navigation" aria-label="世界功能">
          <WorkspaceNavigation />
        </SidebarContent>
        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center" aria-label="当前创造者">
            <Avatar className="size-6 rounded-md"><AvatarFallback className="rounded-md text-[10px]">我</AvatarFallback></Avatar>
            <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">{owner}</span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <nav aria-label="当前位置" className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">{owner}</span>
            {section && <><ChevronRight className="size-3 shrink-0" aria-hidden="true" /><Link href={section.href}>{section.label}</Link></>}
          </nav>
        </header>
        <div id="main-content" className="world-content" tabIndex={-1}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
