import { DBOS } from "@dbos-inc/dbos-sdk";

let scheduleProcessor: (id: string) => Promise<boolean>;
let tickProcessor: () => Promise<{ id: string; workspaceId: string }[]>;
export function registerScheduleTick(processor: typeof tickProcessor) {
  tickProcessor = processor;
}
export function registerScheduleProcessor(processor: typeof scheduleProcessor) {
  scheduleProcessor = processor;
}
const observe = DBOS.registerStep(async (id: string) => scheduleProcessor(id), {
  name: "schedule-observe-and-deliver-v1",
  retriesAllowed: true,
  maxAttempts: 5,
  intervalSeconds: 2,
});
const scheduleWorkflow = DBOS.registerWorkflow(
  async (id: string) => {
    while (!(await observe(id))) await DBOS.sleep(15000);
  },
  { name: "scheduled-run-v1" },
);
export async function ensureScheduledWorkflow(workspaceId: string, id: string) {
  await DBOS.startWorkflow(scheduleWorkflow, {
    workflowID: `schedule:${workspaceId}:${id}`,
  })(id);
}

const tick = DBOS.registerStep(async () => tickProcessor(), {
  name: "schedule-dispatch-tick-step-v1",
  retriesAllowed: true,
  maxAttempts: 3,
  intervalSeconds: 2,
});
const tickWorkflow = DBOS.registerWorkflow(
  async () => {
    // DBOS steps checkpoint data; child workflows must start from workflow
    // context, outside the step. Fixed occurrence IDs make replay idempotent.
    const runs = await tick();
    for (const run of runs ?? [])
      await ensureScheduledWorkflow(run.workspaceId, run.id);
  },
  { name: "schedule-dispatch-tick-v1" },
);

export async function startScheduleClock() {
  const queueName = "hutian-schedule-clock";
  await DBOS.registerQueue(queueName, { globalConcurrency: 1 });
  // RRULE remains the business/calendar recurrence authority (including once,
  // interval-days and month-end). DBOS owns the durable clock and dispatch queue.
  // Business start windows decide missed work; do not replay obsolete clock ticks.
  await DBOS.applySchedules([
    {
      scheduleName: "hutian-schedule-clock",
      workflowFn: tickWorkflow,
      schedule: "*/15 * * * * *",
      automaticBackfill: false,
      cronTimezone: "UTC",
      queueName,
    },
  ]);
}
