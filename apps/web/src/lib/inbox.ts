import type {
  ScheduledInbox,
  ScheduledNoticeChange,
  ScheduledRunNotice,
} from "@hutian-world/contracts";
import { api } from "./api";
export const loadInbox = (
  filter: "all" | "unread" | "attention" = "all",
  cursor?: string,
) =>
  api<ScheduledInbox>(
    `/v1/schedule-inbox?filter=${filter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
export const loadInboxNotice = (id: string) =>
  api<ScheduledRunNotice | null>(`/v1/schedule-inbox/${id}`);
export async function markInbox(
  id: string,
  action: "read" | "unread" | "done",
  updatedAt: string,
) {
  const result = await api<{ change: ScheduledNoticeChange }>(
    `/v1/schedule-inbox/${id}`,
    "POST",
    { action, updatedAt },
  );
  window.dispatchEvent(new Event("hutian:inbox"));
  return result.change;
}
export async function undoInbox(change: ScheduledNoticeChange) {
  await api(`/v1/schedule-inbox/${change.id}/undo`, "POST", change);
  window.dispatchEvent(new Event("hutian:inbox"));
}
