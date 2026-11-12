"use client";

// Adapted from Beautiful UI ToolChips, MIT © 2026 Shane Levine.
// Retains compact icon/label/chip rows and inline details; see ./NOTICE.md.
import { useRef, useState, type ReactNode } from "react";
import { useScrollLock } from "@assistant-ui/react";
import { ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ToolStep = {
  id: string;
  icon: ReactNode;
  label: string;
  chip: string;
  mono: boolean;
  status: "running" | "complete" | "failed" | "unconfirmed";
  statusLabel: string;
  detail: ReactNode;
};

function ToolChipRow({ row }: { row: ToolStep }) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const lockScroll = useScrollLock(rowRef, 200);
  return (
    <Collapsible
      ref={rowRef}
      open={open}
      onOpenChange={(next) => {
        lockScroll();
        setOpen(next);
      }}
      data-slot="beautiful-tool-row"
      data-status={row.status}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group/row h-auto min-h-8 w-full min-w-0 justify-start gap-2 px-1 py-1 text-left"
        >
          <span className="relative flex size-4 shrink-0 items-center justify-center text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn(
                "transition-opacity duration-150 group-hover/row:opacity-0 group-focus-visible/row:opacity-0 motion-reduce:transition-none",
                open && "opacity-0",
              )}
            >
              {row.icon}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "absolute transition-[opacity,transform] duration-150 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 motion-reduce:transition-none",
                open ? "opacity-100" : "-rotate-90 opacity-0",
              )}
            />
          </span>
          <span className="shrink-0 text-xs font-medium">{row.label}</span>
          <span
            title={row.chip}
            className={cn(
              "min-w-0 flex-1 truncate text-xs font-normal text-muted-foreground",
              row.mono && "font-mono",
            )}
          >
            {row.chip}
          </span>
          <span
            className={cn(
              "inline-flex max-w-56 shrink-0 items-center gap-1 text-[11px] font-normal text-muted-foreground",
              row.status === "failed" && "text-destructive",
            )}
          >
            {row.status === "running" ? (
              <LoaderCircle aria-hidden="true" className="size-3 motion-safe:animate-spin" />
            ) : row.status === "failed" || row.status === "unconfirmed" ? (
              <CircleAlert aria-hidden="true" className="size-3" />
            ) : null}
            <span className="truncate" title={row.statusLabel}>
              {row.statusLabel}
            </span>
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up motion-reduce:animate-none">
        <div className="mt-0.5 mb-1 ml-2 flex min-w-0 flex-col gap-2 border-l py-1 pl-3.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {row.detail}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ToolChips({ steps }: { steps: ToolStep[] }) {
  return (
    <div data-slot="beautiful-tool-chips" className="flex w-full min-w-0 flex-col gap-1 pb-1">
      {steps.map((row) => (
        <ToolChipRow key={row.id} row={row} />
      ))}
    </div>
  );
}
