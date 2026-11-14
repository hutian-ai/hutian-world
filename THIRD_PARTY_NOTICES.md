# Third-party notices

The UI primitives and the `cn` helper are adapted from the existing hutian project's shadcn/ui components. The reused conversation components in `apps/web/src/components/assistant-ui/` use assistant-ui and Lexical. Package dependencies retain their respective licenses in their distributions. Copied registry source has accompanying attribution in [Dice UI notice](apps/web/src/components/ui/NOTICE-dice-ui.md), [Beautiful UI notice](apps/web/src/components/beautiful-ui/NOTICE.md) and [context card notice](apps/web/src/components/beautiful-ui/NOTICE-context-cards.md). The hutian brand asset was copied from the user's existing hutian project; no third-party artwork was generated or downloaded.

The Runtime provider logos come from the existing hutian project. Their original sources and trademark information are listed in the [Runtime logo attribution](apps/web/public/runtime-logos/ATTRIBUTION.md).

## FullCalendar

The `event-calendar.tsx`, `event-calendar-toolbar.tsx`, `event-calendar-icons.tsx` and existing `ui/event-calendar-views.tsx` reuse the user's old hutian integration of the official FullCalendar shadcn Forma registry, version 7.1.0 (MIT). The calendar's package and its registry source are credited to FullCalendar / Adam Shaw. Calendar layouts are provided by the existing `@fullcalendar/react` dependency; no demo events or timers are copied.

Copyright (c) 2026 Adam Shaw. Licensed under the MIT license reproduced below for shadcn/ui, with this copyright notice retained. The installed FullCalendar distribution also includes its full `LICENSE.md`.

## shadcn/ui

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Schedule dependencies

Recurrence calculation uses `rrule` 2.8.1 (BSD-3-Clause, https://github.com/jkbrzt/rrule) and `temporal-polyfill` 1.0.5 (MIT, https://github.com/fullcalendar/temporal-polyfill), as in the user's existing hutian project. Their distributions retain their license files. The task client uses the existing `@harness-dock/client` public SDK (MIT); it does not copy or modify the native runtime or its private configuration.
