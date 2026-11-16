import { z } from "zod";
import { notFound } from "@/lib/navigation";
import { ScheduleDetail } from "@/components/schedule-detail";
import { loadSchedule } from "@/lib/schedule-actions";
import { getWorkspace } from "@/lib/api";
import { scheduleReturnTo } from "@/lib/schedule-display";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params,
    query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await loadSchedule(id);
  if (!result.ok)
    return (
      <Alert variant="destructive">
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  const workspace = await getWorkspace();
  return (
    <ScheduleDetail
      initial={result}
      roles={workspace.roles}
      roleName={
        workspace.roles.find((role) => role.id === result.task.roleId)?.name ??
        "成员暂不可用"
      }
      returnTo={scheduleReturnTo(query.returnTo)}
    />
  );
}
