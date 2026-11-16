import { Badge } from "@hutian-ai/design/ui/badge";
import { cn } from "@hutian-ai/design/lib/utils";

const positive = new Set([
  "active",
  "ready",
  "running",
  "completed",
  "accepted",
  "approved",
  "success",
  "connected",
  "selected",
  "resolved",
]);
const warning = new Set([
  "queued",
  "waiting",
  "open",
  "planned",
  "degraded",
  "claimed",
  "outcome_unknown",
  "not_found",
  "auth_required",
  "temporarily_failed",
]);
const danger = new Set([
  "failed",
  "failure",
  "blocked",
  "rejected",
  "unavailable",
  "error",
  "unsupported_version",
  "protocol_error",
]);

export type StatusTone = "positive" | "warning" | "danger" | "neutral";

export function statusTone(value: string): StatusTone {
  if (positive.has(value)) return "positive";
  if (warning.has(value)) return "warning";
  if (danger.has(value)) return "danger";
  return "neutral";
}

export function StatusBadge({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const tone = statusTone(value);
  return (
    <Badge
      variant="outline"
      className={cn(
        tone === "positive" && "border-primary/30 bg-primary/10 text-primary",
        tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
        tone === "danger" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {label}
    </Badge>
  );
}
