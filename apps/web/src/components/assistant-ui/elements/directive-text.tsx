"use client";

import type { FC } from "react";
import { Badge } from "@/components/ui/badge";

type IconComponent = FC<{ className?: string }>;

export type DirectiveTextSegment =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "mention";
      readonly type: string;
      readonly label: string;
      readonly id: string;
    };

export type DirectiveTextFormatter = {
  /** Parse text into alternating text and directive segments. */
  parse(text: string): readonly DirectiveTextSegment[];
};

export type CreateDirectiveTextOptions = {
  /** Maps a directive `type` to an icon component. */
  iconMap?: Record<string, IconComponent>;
  /** Icon rendered when `iconMap` has no entry for the segment type. */
  fallbackIcon?: IconComponent;
  /** Accessible label for a rendered directive chip. */
  getAriaLabel?: (segment: Extract<DirectiveTextSegment, { kind: "mention" }>) => string;
};

type DirectiveTextContentProps = CreateDirectiveTextOptions & {
  formatter: DirectiveTextFormatter;
  text: string;
};

export const DirectiveTextContent: FC<DirectiveTextContentProps> = ({
  formatter,
  text,
  iconMap,
  fallbackIcon,
  getAriaLabel,
}) => {
  const segments = formatter.parse(text);

  if (segments.length === 1 && segments[0]!.kind === "text") {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return (
            <span key={i} className="whitespace-pre-wrap">
              {seg.text}
            </span>
          );
        }

        const Icon = iconMap?.[seg.type] ?? fallbackIcon;
        return (
          <Badge
            key={i}
            variant="secondary"
            data-slot="directive-text-chip"
            data-directive-type={seg.type}
            data-directive-id={seg.id}
            aria-label={getAriaLabel?.(seg) ?? `${seg.type}: ${seg.label}`}
            className="aui-directive-chip border-primary/20 bg-primary/10 text-foreground hover:bg-primary/10 mx-0.5 inline-flex items-baseline gap-1 px-1.5 py-0.5 text-[13px] leading-none font-medium [&_svg]:size-3 [&_svg]:self-center [&_svg]:text-primary"
          >
            {Icon && <Icon />}
            {seg.label}
          </Badge>
        );
      })}
    </>
  );
};

/** Creates a text component that parses directive syntax and renders inline chips. */
export function createDirectiveText(
  formatter: DirectiveTextFormatter,
  options?: CreateDirectiveTextOptions,
): FC<{ text: string }> {
  const Component: FC<{ text: string }> = ({ text }) => (
    <DirectiveTextContent formatter={formatter} text={text} {...options} />
  );
  Component.displayName = "DirectiveText";
  return Component;
}
