import type {
  ScheduledInbox,
  ScheduledRunNotice,
} from "@hutian-world/contracts";
import { api } from "./api";
export const loadInbox = (filter: "all" | "unread" | "attention" = "all") =>
  api<ScheduledInbox>(`/v1/schedule-inbox?filter=${filter}`);
export const loadInboxNotice = (id: string) =>
  api<ScheduledRunNotice | null>(`/v1/schedule-inbox/${id}`);
export async function markInbox(
  id: string,
  action: "read" | "unread" | "done",
  updatedAt: string,
) {
  await api(`/v1/schedule-inbox/${id}`, "POST", { action, updatedAt });
  window.dispatchEvent(new Event("hutian:inbox"));
}
