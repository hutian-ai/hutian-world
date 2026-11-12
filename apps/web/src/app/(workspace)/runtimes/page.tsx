import { Plug } from "lucide-react";
import { DockConnectionDialog, RefreshDockButton } from "@/components/dock-connection";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { RuntimeDirectory } from "@/components/runtime-directory";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { WorkspaceSurface } from "@/components/workspace-surface";
import { getDockConnection } from "@/lib/dock";

export const dynamic = "force-dynamic";

export default async function RuntimesPage() {
  const connection = await getDockConnection();
  const connected = connection.state === "connected";
  return (
    <>
      <PageHeader title="运行环境" description="管理提供执行环境的机器，查看连接状态与可用的 Harness。"
        meta={connected ? <Badge variant="outline">{connection.devices.length} 台机器</Badge> : undefined}
        action={<div className="flex flex-wrap items-center gap-2">
          {connection.state === "error" && <RefreshDockButton />}
          <DockConnectionDialog replacing={connection.state !== "missing"} endpoint={connected ? connection.endpoint : undefined} />
        </div>} />
      <WorkspaceSurface label="电脑目录">
        {connected ? (
          <RuntimeDirectory devices={connection.devices} endpoint={connection.endpoint} />
        ) : connection.state === "missing" ? (
          <EmptyState title="还未连接 Dock Server" detail="配置服务连接后，Hutian 会统一读取服务端已授权的机器与 Harness。" icon={Plug} />
        ) : (
          <div className="p-4"><Alert variant="destructive"><AlertTitle>无法连接 Dock Server</AlertTitle><AlertDescription>{connection.message}</AlertDescription></Alert></div>
        )}
      </WorkspaceSurface>
    </>
  );
}
