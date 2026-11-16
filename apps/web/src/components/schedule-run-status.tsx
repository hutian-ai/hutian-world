import type { ScheduledRun } from "@hutian-world/contracts";
import { Badge } from "@hutian-ai/design/ui/badge";
import { scheduleStateLabels } from "@/lib/schedule-display";

export function scheduleRunTone(state: ScheduledRun["state"], handled = false) {
  if (handled) return "text-muted-foreground";
  if (["failed", "missed"].includes(state)) return "text-destructive";
  if (["waiting_permission", "blocked", "unknown"].includes(state))
    return "text-warning";
  if (state === "replied") return "text-primary";
  return "text-muted-foreground";
}

export function ScheduleRunStatus({
  state,
  handled = false,
  current = false,
}: {
  state: ScheduledRun["state"];
  handled?: boolean;
  current?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={`shrink-0 ${scheduleRunTone(state, handled)}`}
    >
      {current ? "本次" : ""}
      {scheduleStateLabels[state]}
      {handled ? " · 已处理" : ""}
    </Badge>
  );
}
