"use client";
import { unstable_useMentionAdapter } from "@assistant-ui/react";
import type { DirectiveChipProps } from "@assistant-ui/react-lexical";
import { AtSign } from "lucide-react";
import { ComposerTriggerPopover } from "@hutian-ai/design/assistant-ui/elements/composer-trigger-popover.aui";
import {
  memberMentionFormatter,
  memberMentionMatcher,
} from "@/lib/conversation-mentions";

export function ChatMentionTrigger({
  agents,
}: {
  agents: Array<{ id: string; name: string }>;
}) {
  const mention = unstable_useMentionAdapter({
    items: agents.map((a) => ({
      id: a.id,
      type: "member",
      label:
        agents.filter((b) => b.name === a.name).length > 1
          ? `${a.name}（${a.id.slice(-6)}）`
          : a.name,
      description: "请这位成员处理",
      icon: "member",
    })),
    includeModelContextTools: false,
    formatter: memberMentionFormatter,
    iconMap: { member: AtSign },
    fallbackIcon: AtSign,
  });
  return (
    <ComposerTriggerPopover
      char="@"
      matcher={memberMentionMatcher}
      {...mention}
      backLabel="返回"
      emptyCategoriesLabel="暂无可点名的成员"
      emptyItemsLabel="没有匹配的成员"
      aria-label="选择回复成员"
    />
  );
}
export function ChatMentionChip({ directiveId, label }: DirectiveChipProps) {
  return (
    <span
      data-slot="composer-mention-chip"
      data-member-id={directiveId}
      className="aui-directive-chip mx-0.5 inline-flex items-baseline gap-0.5 rounded border border-primary/20 bg-primary/10 px-1 text-sm text-foreground"
      aria-label={`请 ${label} 处理`}
    >
      <span className="text-primary">@</span>
      {label}
    </span>
  );
}
