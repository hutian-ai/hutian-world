import { ScheduleEditor } from "@/components/schedule-editor";
import { scheduleChoices } from "@/lib/schedule-data";
import { scheduleReturnTo } from "@/lib/schedule-display";
import { memberReturnTo } from "@/lib/workspace-navigation";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    returnTo?: string;
    role?: string;
    from?: string;
  }>;
}) {
  const query = await searchParams;
  try {
    return (
      <ScheduleEditor
        initial={null}
        initialRoleId={query.role}
        initialDate={
          query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
            ? query.date
            : undefined
        }
        returnTo={scheduleReturnTo(
          query.returnTo ??
            (query.role
              ? `/schedules?${new URLSearchParams({ role: query.role })}`
              : undefined),
        )}
        cancelTo={memberReturnTo(query.from)}
        {...await scheduleChoices()}
      />
    );
  } catch {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          暂时无法读取成员，请核对服务连接后重试。
        </AlertDescription>
      </Alert>
    );
  }
}
