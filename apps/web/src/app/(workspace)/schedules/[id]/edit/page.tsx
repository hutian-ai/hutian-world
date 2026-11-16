import { z } from "zod";
import { notFound } from "@/lib/navigation";
import { ScheduleEditor } from "@/components/schedule-editor";
import { scheduleChoices } from "@/lib/schedule-data";
import { loadSchedule } from "@/lib/schedule-actions";
import { scheduleReturnTo } from "@/lib/schedule-display";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
export default async function EditSchedulePage({
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
  if (!result.ok || result.task.deletedAt)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {!result.ok
            ? result.error
            : "任务已删除，不能编辑。运行记录仍然保留。"}
        </AlertDescription>
      </Alert>
    );
  try {
    return (
      <ScheduleEditor
        initial={result.task}
        returnTo={scheduleReturnTo(query.returnTo)}
        {...await scheduleChoices()}
      />
    );
  } catch {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          暂时无法读取编辑选项，请核对服务连接后重试。
        </AlertDescription>
      </Alert>
    );
  }
}
