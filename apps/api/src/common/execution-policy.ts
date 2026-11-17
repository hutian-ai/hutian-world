/** Delivery state belongs to Hutian; native execution state belongs to Dock. */
export const chatTerminalStates = [
  "replied",
  "failed",
  "cancelled",
  "blocked",
  "skipped",
];
export const scheduleActiveStates = [
  "queued",
  "preparing",
  "running",
  "waiting_permission",
  "blocked",
  "unknown",
];
export const scheduleTerminalStates = [
  "replied",
  "failed",
  "cancelled",
  "missed",
  "skipped",
];
export const nativeTerminalStates = [
  "completed",
  "failed",
  "cancelled",
  "skipped",
];
/** Failed observations never create a replacement run; cap polling and retain the original identity. */
export function observationBackoff(attempts: number) {
  return new Date(
    Date.now() + Math.min(300000, 2000 * 2 ** Math.min(attempts, 8)),
  );
}
