"use client";

// Adopted via the official FullCalendar shadcn registry, Forma, v7.1.0 (MIT).
import type { CalendarController } from "@fullcalendar/react";
import {
  EventCalendarNextIcon,
  EventCalendarPrevIcon,
} from "@/components/event-calendar-icons";
import { Button } from "@hutian-ai/design/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@hutian-ai/design/ui/tabs";
import { cn } from "@hutian-ai/design/lib/utils";

export interface EventCalendarToolbarProps {
  className?: string;
  controller: CalendarController;
  availableViews: string[];
  addButton?: {
    isPrimary?: boolean;
    text?: string;
    hint?: string;
    click?: () => void;
  };
}

export function EventCalendarToolbar({
  className,
  controller,
  availableViews,
  addButton,
}: EventCalendarToolbarProps) {
  const buttons = controller.getButtonState();
  const viewType = controller.view?.type ?? availableViews[0];
  const navigationLabels: Record<string, readonly [string, string]> = {
    dayGridWeek: ["上一周", "下一周"],
    dayGridMonth: ["上个月", "下个月"],
    listWeek: ["上一周日程", "下一周日程"],
  };
  const [previousLabel, nextLabel] = navigationLabels[viewType ?? ""] ?? [
    buttons.prev.hint,
    buttons.next.hint,
  ];

  return (
    <div
      className={cn(
        "flex items-center justify-between flex-wrap gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        {addButton && (
          <Button onClick={addButton.click} aria-label={addButton.hint}>
            {addButton.text}
          </Button>
        )}
        <Button
          onClick={() => controller.today()}
          aria-label={buttons.today.hint}
          variant="outline"
        >
          今天
        </Button>
        <div className="flex items-center">
          <Button
            onClick={() => controller.prev()}
            disabled={buttons.prev.isDisabled}
            aria-label={previousLabel}
            variant="ghost"
            size="icon"
          >
            <EventCalendarPrevIcon />
          </Button>
          <Button
            onClick={() => controller.next()}
            disabled={buttons.next.isDisabled}
            aria-label={nextLabel}
            variant="ghost"
            size="icon"
          >
            <EventCalendarNextIcon />
          </Button>
        </div>
        <div className="min-w-0 text-sm font-semibold sm:text-base">
          {controller.view?.title}
        </div>
      </div>
      <Tabs
        value={viewType}
        onValueChange={(view) => controller.changeView(view)}
      >
        <TabsList>
          {availableViews.map((availableView) => (
            <TabsTrigger
              key={availableView}
              value={availableView}
              aria-label={buttons[availableView]?.hint}
            >
              {(
                {
                  dayGridWeek: "周",
                  dayGridMonth: "月",
                  listWeek: "日程",
                } as Record<string, string>
              )[availableView] ?? buttons[availableView]?.text}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
