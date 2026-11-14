import { ScheduleEditor } from "@/components/schedule-editor";
import { scheduleChoices } from "@/lib/schedule-data";
import { scheduleReturnTo } from "@/lib/schedule-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
export default async function NewSchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; returnTo?: string }> }) {
  const query = await searchParams;
  try {
    return <ScheduleEditor initial={null} initialDate={query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : undefined} returnTo={scheduleReturnTo(query.returnTo)} {...await scheduleChoices()} />;
  } catch { return <Alert variant="destructive"><AlertDescription>暂时无法读取成员与会话，请核对服务连接后重试。</AlertDescription></Alert>; }
}
