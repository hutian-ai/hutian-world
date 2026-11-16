import { SchedulesWorkspace } from "@/components/schedules-workspace";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { api, getWorkspace } from "@/lib/api";
import type { ScheduledTask, ScheduledRun } from "@hutian-world/contracts";
export default async function SchedulesPage() {
  try {
    const [data, workspace] = await Promise.all([
      api<{ tasks: ScheduledTask[]; runs: ScheduledRun[] }>("/v1/schedules"),
      getWorkspace(),
    ]);
    return (
      <>
        <SchedulesWorkspace
          initial={data}
          roles={workspace.roles.map(({ id, name }) => ({ id, name }))}
        />
      </>
    );
  } catch {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          暂时无法读取定时安排，请核对应用与通信服务连接后重新打开。
        </AlertDescription>
      </Alert>
    );
  }
}
