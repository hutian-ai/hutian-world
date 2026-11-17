import {
  scheduleCalendarQuery,
  scheduleInput,
  scheduleRule,
} from "@hutian-world/contracts";
import { previewSchedule } from "@hutian-world/contracts/schedule-time";
import { z } from "zod";
import {
  ApplicationError,
  actionFailure,
} from "../../common/errors/application-error.js";
import type { ApplicationServices } from "../application-services.js";
function failure(error: unknown) {
  return actionFailure(error);
}
export async function loadSchedules(
  app: Pick<ApplicationServices, "schedules">,
) {
  try {
    return {
      ok: true as const,
      ...(await app.schedules.list()),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function loadSchedule(
  app: Pick<ApplicationServices, "schedules">,
  id: string,
) {
  try {
    return {
      ok: true as const,
      ...(await app.schedules.getTask(z.uuid().parse(id))),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function loadScheduledRun(
  app: Pick<ApplicationServices, "schedules">,
  id: string,
) {
  try {
    return {
      ok: true as const,
      run: await app.schedules.getRun(z.uuid().parse(id)),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function deleteSchedule(
  app: Pick<ApplicationServices, "schedules">,
  id: string,
  expectedRevision: number,
) {
  try {
    await app.schedules.remove(
      z.uuid().parse(id),
      z.number().int().positive().parse(expectedRevision),
    );
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function loadScheduleCalendar(
  app: Pick<ApplicationServices, "schedules">,
  input: unknown,
) {
  try {
    const query = scheduleCalendarQuery.parse(input);
    return {
      ok: true as const,
      ...(await app.schedules.calendar(query)),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function saveSchedule(
  app: Pick<ApplicationServices, "schedules" | "workspace">,
  input: unknown,
  expectedRevision: number | null,
) {
  try {
    const task = scheduleInput.parse(input);
    const role = (await app.workspace.overview()).roles.find(
      (r) => r.id === task.roleId,
    );
    if (!role) throw new ApplicationError("成员不存在或不可访问。");
    const saved =
      expectedRevision === null
        ? await app.schedules.save(task, null)
        : await app.schedules.save(
            task,
            z.number().int().positive().parse(expectedRevision),
          );
    return { ok: true as const, task: saved };
  } catch (error) {
    return failure(error);
  }
}
export async function toggleSchedule(
  app: Pick<ApplicationServices, "schedules">,
  id: string,
  enabled: boolean,
  expectedRevision: number,
) {
  try {
    await app.schedules.setEnabled(
      z.uuid().parse(id),
      z.boolean().parse(enabled),
      z.number().int().positive().parse(expectedRevision),
    );
    return { ok: true as const };
  } catch (error) {
    return failure(error);
  }
}
export async function runSchedule(
  app: Pick<ApplicationServices, "schedules">,
  id: string,
  requestId: string,
) {
  try {
    const run = await app.schedules.runNow(
      z.uuid().parse(id),
      z.uuid().parse(requestId),
    );
    return { ok: true as const, run };
  } catch (error) {
    return failure(error);
  }
}
export async function previewScheduleRule(
  app: ApplicationServices,
  input: unknown,
) {
  try {
    return {
      ok: true as const,
      ...(await { starts: previewSchedule(scheduleRule.parse(input)) }),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readScheduledResult(
  app: ApplicationServices,
  id: string,
) {
  try {
    const { scheduledResult } =
      await import("../resources/report-attachments.js");
    const result = await scheduledResult(app, z.uuid().parse(id));
    return {
      ok: true as const,
      message: result.message,
      attachments: result.attachments,
      outputsState: result.outputsState,
    };
  } catch (error) {
    return failure(error);
  }
}
