"use client";
import { Hash, MessageCircle, UsersRound } from "lucide-react";
export const labels = { direct: "私聊", group: "群聊", channel: "频道" };
export const icons = {
  direct: MessageCircle,
  group: UsersRound,
  channel: Hash,
};
export function href(id: string) {
  return `/chat?${new URLSearchParams({ room: id })}`;
}
