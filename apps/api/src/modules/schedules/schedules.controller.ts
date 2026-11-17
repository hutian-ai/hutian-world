import { SERVICE_ENDPOINT } from "../access/browser-session.service.js";
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  SetMetadata,
} from "@nestjs/common";
import { z } from "zod";
import { previewSchedule } from "@hutian-world/contracts/schedule-time";
import {
  scheduleInput,
  scheduleRule,
  scheduleCalendarQuery,
  scheduledNoticeChange,
} from "@hutian-world/contracts";
import { SchedulesService } from "./schedules.service.js";
@Controller("v1")
export class SchedulesController {
  constructor(
    @Inject(SchedulesService) private readonly schedules: SchedulesService,
  ) {}
  @Get("schedule-inbox") inbox(@Query("filter") filter: unknown) {
    return this.schedules.inbox(
      z.enum(["all", "unread", "attention"]).default("all").parse(filter),
    );
  }
  @Post("schedule-inbox/:id") markNotice(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({
        action: z.enum(["read", "unread", "done"]),
        updatedAt: z.iso.datetime({ offset: true }),
      })
      .strict()
      .parse(body);
    return this.schedules.markNotice(id, input.action, input.updatedAt);
  }
  @Get("schedule-inbox/:id") notice(
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.schedules.notice(id);
  }
  @Post("schedule-inbox/:id/undo") undoNotice(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.schedules.undoNotice(
      scheduledNoticeChange.extend({ id: z.literal(id) }).parse(body),
    );
  }
  @Get("schedules") list() {
    return this.schedules.list();
  }
  @Get("schedules/calendar") calendar(@Query() query: unknown) {
    return this.schedules.calendar(scheduleCalendarQuery.parse(query));
  }
  @Get("schedules/:id") getTask(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.schedules.getTask(id);
  }
  @Delete("schedules/:id") remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.schedules.remove(
      id,
      z
        .object({ expectedRevision: z.number().int().positive() })
        .strict()
        .parse(body).expectedRevision,
    );
  }
  @Post("schedules") create(@Body() body: unknown) {
    return this.schedules.save(scheduleInput.parse(body), null);
  }
  @Put("schedules/:id") update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({
        task: scheduleInput,
        expectedRevision: z.number().int().positive(),
      })
      .strict()
      .parse(body);
    if (input.task.id !== id) throw new Error("schedule_identity_mismatch");
    return this.schedules.save(input.task, input.expectedRevision);
  }
  @Post("schedules/preview") preview(@Body() body: unknown) {
    return { starts: previewSchedule(scheduleRule.parse(body)) };
  }
  @Post("schedules/:id/enabled") enable(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = z
      .object({
        enabled: z.boolean(),
        expectedRevision: z.number().int().positive(),
      })
      .strict()
      .parse(body);
    return this.schedules.setEnabled(id, input.enabled, input.expectedRevision);
  }
  @Post("schedules/:id/run") run(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.schedules.runNow(
      id,
      z.object({ requestId: z.uuid() }).strict().parse(body).requestId,
    );
  }
  @Get("scheduled-runs/:id") getRun(
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.schedules.getRun(id);
  }
  @SetMetadata(SERVICE_ENDPOINT, true)
  @Put("scheduled-runs/:id/event")
  recordEvent(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.schedules.recordEvent(
      id,
      z
        .object({ eventId: z.string().startsWith("$").max(500) })
        .strict()
        .parse(body).eventId,
    );
  }
}
