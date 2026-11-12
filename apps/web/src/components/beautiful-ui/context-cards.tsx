"use client";

// Adapted from Beautiful UI ContextCards, MIT © 2026 Shane Levine.
// Source and changes: ./NOTICE-context-cards.md. All content comes from verified citations.
import { useState, type ReactNode, type Ref } from "react";
import { ChevronDown, Files, TextQuote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type ContextChunk = {
  id: string;
  title: string;
  reference: string;
  body: string;
  source: ReactNode;
};

export default function ContextCards({
  chunks,
  summary,
  containerRef,
  onExpandedChange,
}: {
  chunks: readonly ContextChunk[];
  summary: string;
  containerRef?: Ref<HTMLDivElement>;
  onExpandedChange?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible
      ref={containerRef}
      open={expanded}
      onOpenChange={(open) => {
        onExpandedChange?.();
        setExpanded(open);
      }}
      data-slot="beautiful-context-cards"
      className="flex min-w-0 flex-col gap-2"
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto w-fit max-w-full justify-start py-1.5">
          <Files data-icon="inline-start" aria-hidden="true" />
          <span>引用资料</span>
          <span className="text-xs font-normal text-muted-foreground tabular-nums">{summary}</span>
          <ChevronDown
            data-icon="inline-end"
            aria-hidden="true"
            className={cn(
              "transition-transform motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="min-w-0">
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          {chunks.map((chunk) => (
            <Card key={chunk.id} className="min-w-0 gap-2 overflow-hidden py-3">
              <CardHeader className="flex flex-row items-start gap-2 px-3">
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {chunk.reference}
                </Badge>
                <CardTitle className="min-w-0 text-xs font-medium leading-5 [overflow-wrap:anywhere]">
                  {chunk.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-w-0 px-3">
                <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                  {chunk.body}
                </p>
              </CardContent>
              <CardFooter className="mt-auto gap-1.5 px-3">
                <TextQuote className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {chunk.source}
              </CardFooter>
            </Card>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
