import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CircleDashed } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@hutian-ai/design/ui/empty";

export function EmptyState({
  title,
  detail,
  icon: Icon = CircleDashed,
  action,
}: {
  title: string;
  detail: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <Empty className="min-h-48 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{detail}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
