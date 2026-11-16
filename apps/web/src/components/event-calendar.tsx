"use client";

// Adopted via the official FullCalendar shadcn registry, Forma, v7.1.0 (MIT).
import {
  type CalendarOptions,
  useCalendarController,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import { EventCalendarToolbar } from "@/components/event-calendar-toolbar";
import { EventCalendarViews } from "@hutian-ai/design/ui/event-calendar-views";
import { EventCalendarCloseIcon } from "@/components/event-calendar-icons";
import { cn } from "@hutian-ai/design/lib/utils";

const plugins = [dayGridPlugin, listPlugin, interactionPlugin];
const defaultAvailableViews = ["dayGridWeek", "dayGridMonth", "listWeek"];
const navLinkDayClick = "listWeek";
const navLinkWeekClick = "dayGridWeek";

export interface EventCalendarProps extends Omit<
  CalendarOptions,
  "class" | "className" | "headerToolbar" | "footerToolbar"
> {
  className?: string;
  scrollGrid?: boolean;
  availableViews?: string[];
  addButton?: {
    isPrimary?: boolean;
    text?: string;
    hint?: string;
    click?: () => void;
  };
}

export function EventCalendar({
  availableViews = defaultAvailableViews,
  addButton,
  direction,
  className,
  scrollGrid = false,
  height,
  contentHeight,
  plugins: userPlugins = [],
  ...restOptions
}: EventCalendarProps) {
  const controller = useCalendarController();

  const hasBorderX = !(restOptions.borderlessX ?? restOptions.borderless);
  const hasBorderTop = !(restOptions.borderlessTop ?? restOptions.borderless);
  const hasBorderBottom = !(
    restOptions.borderlessBottom ?? restOptions.borderless
  );
  const isHeightAuto = height === "auto" || contentHeight === "auto";

  return (
    <div
      className={cn(
        className,
        "flex flex-col bg-background",
        hasBorderX && "border-x",
        hasBorderTop && "border-t",
        hasBorderBottom && "border-b",
        hasBorderTop && hasBorderX && "rounded-t-sm",
        hasBorderBottom && hasBorderX && "rounded-b-sm",
        hasBorderX && hasBorderTop && hasBorderBottom && "shadow-xs",
        !isHeightAuto && "overflow-hidden",
      )}
      style={{ height }}
      dir={direction === "rtl" ? "rtl" : undefined}
    >
      <EventCalendarToolbar
        className="border-b p-3"
        controller={controller}
        availableViews={availableViews}
        addButton={addButton}
      />
      <div
        className={cn("grow min-h-0", scrollGrid && "overflow-x-auto")}
        role={scrollGrid ? "region" : undefined}
        aria-label={scrollGrid ? "日历日期网格" : undefined}
        tabIndex={scrollGrid ? 0 : undefined}
      >
        <div className={cn("h-full", scrollGrid && "min-w-[840px]")}>
          <EventCalendarViews
            controller={controller}
            height={
              isHeightAuto
                ? "auto"
                : height !== undefined
                  ? "100%"
                  : contentHeight
            }
            initialView={availableViews[0]}
            navLinkDayClick={navLinkDayClick}
            navLinkWeekClick={navLinkWeekClick}
            plugins={[...plugins, ...userPlugins]}
            popoverCloseContent={() => <EventCalendarCloseIcon />}
            {...restOptions}
          />
        </div>
      </div>
    </div>
  );
}
