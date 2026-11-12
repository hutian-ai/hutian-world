import { cookies } from "next/headers";
import { getWorkspace } from "@/lib/api";
import { WorkspaceShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const [workspace, preferences] = await Promise.all([getWorkspace(), cookies()]);
  return (
    <WorkspaceShell owner={workspace.creator.displayName} defaultSidebarOpen={preferences.get("sidebar_state")?.value !== "false"}>
      {children}
    </WorkspaceShell>
  );
}
