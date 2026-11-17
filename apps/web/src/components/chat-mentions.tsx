"use client";
import { unstable_useMentionAdapter, useAuiState } from "@assistant-ui/react";
import type { DirectiveChipProps } from "@assistant-ui/react-lexical";
import { AtSign } from "lucide-react";
import { ComposerTriggerPopover } from "@hutian-ai/design/assistant-ui/elements/composer-trigger-popover.aui";
import { ChatMention } from "@hutian-ai/design/chat/mention";
import { MarkdownText } from "@hutian-ai/design/assistant-ui/markdown-text";
import { useMemo, type ComponentProps } from "react";
import {
  memberMentionFormatter,
  memberMentionMatcher,
  messageMentionPlugin,
  type MessageMention,
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
    <ChatMention
      id={directiveId}
      label={label}
      ariaLabel={`请 ${label} 处理`}
    />
  );
}

const mentionComponents: NonNullable<
  ComponentProps<typeof MarkdownText>["components"]
> = {
  span: (input) => {
    const {
      children,
      className,
      "data-member-id": id,
      "data-member-label": label,
    } = input as typeof input & {
      "data-member-id"?: string;
      "data-member-label"?: string;
    };
    return typeof id === "string" && typeof label === "string" ? (
      <ChatMention id={id} label={label} />
    ) : (
      <span className={className}>{children}</span>
    );
  },
};

export function ChatMessageText() {
  const mentions = useAuiState(
    (s) => s.message.metadata.custom.mentions as MessageMention[] | undefined,
  );
  const plugins = useMemo(
    () => [messageMentionPlugin(mentions ?? [])],
    [mentions],
  );
  return (
    <MarkdownText components={mentionComponents} remarkPlugins={plugins} />
  );
}
