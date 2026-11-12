"use client";

// Adapted from Beautiful UI ThinkingState, MIT © 2026 Shane Levine.
// Source and changes: ./NOTICE.md. Status/content come from the caller, never a demo timer.
import { useRef, useState, type PropsWithChildren } from "react";
import { useScrollLock } from "@assistant-ui/react";
import { ChevronDown, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function ThinkingState({
  label,
  active,
  summary,
  defaultOpen = false,
  children,
}: PropsWithChildren<{ label: string; active: boolean; summary?: string; defaultOpen?: boolean }>) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const traceRef = useRef<HTMLDivElement>(null);
  const lockScroll = useScrollLock(traceRef, 200);

  return (
    <Collapsible
      ref={traceRef}
      open={expanded}
      onOpenChange={(open) => {
        lockScroll();
        setExpanded(open);
      }}
      data-slot="beautiful-thinking"
      className="flex w-full min-w-0 flex-col"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-h-8 w-fit max-w-full justify-start px-1.5 py-1"
        >
          {active ? (
            <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          <span className="min-w-0 text-left text-xs font-normal text-muted-foreground tabular-nums [overflow-wrap:anywhere] whitespace-normal">
            <span className="block">{label}</span>
            {summary ? <span className="mt-0.5 block text-foreground/80">{summary}</span> : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="transition-transform duration-200 motion-reduce:transition-none"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up motion-reduce:animate-none">
        <div className="relative mt-1 ml-2 max-h-80 overflow-y-auto overscroll-contain border-l py-1 pl-4 pr-1 [overflow-wrap:anywhere]">
          <div className="flex min-w-0 flex-col gap-1">{children}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
