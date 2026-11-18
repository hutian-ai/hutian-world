import { nextScheduleStart } from "@hutian-world/contracts/schedule-time";
import { Inject, Injectable } from "@nestjs/common";
import { DataSource, In, IsNull, Raw } from "typeorm";
import { publicError } from "../../common/errors/application-error.js";
import {
  scheduleActiveStates as active,
  observationBackoff,
  scheduleTerminalStates,
} from "../../common/execution-policy.js";
import { AccessContexts } from "../../modules/access/access-context.service.js";
import {
  ScheduledRunSchema,
  ScheduledTaskSchema,
} from "../../modules/schedules/entities/schedule.schema.js";
import {
  ensureScheduledWorkflow,
  registerScheduleProcessor,
  registerScheduleTick,
  startScheduleClock,
} from "../../modules/schedules/schedule.workflow.js";
import { runView } from "../../modules/schedules/schedules.mapper.js";
import { SchedulesService } from "../../modules/schedules/schedules.service.js";
import { ExecutionApplication } from "../execution.application.js";
@Injectable()
export class SchedulesRunner {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
    @Inject(ExecutionApplication) private readonly host: ExecutionApplication,
    @Inject(SchedulesService) private readonly schedules: SchedulesService,
  ) {
    registerScheduleProcessor(async (id) =>
      this.contexts.run(await this.contexts.local(), () => this.observeRun(id)),
    );
    registerScheduleTick(async () =>
      this.contexts.run(await this.contexts.local(), () => this.collectRuns()),
    );
  }
  private get owner() {
    const c = this.contexts.current();
    return {
      creator_id: c.creatorId,
      workspace_id: c.workspaceId,
      created_by_user_id: c.userId,
    };
  }
  async start() {
    await startScheduleClock();
    // Reconcile persisted intent immediately, even before the next clock tick.
    const runs = await this.contexts.run(await this.contexts.local(), () =>
      this.collectRuns(),
    );
    for (const run of runs)
      await ensureScheduledWorkflow(run.workspaceId, run.id);
  }
  private async due() {
    await this.db.transaction(async (manager) => {
      // Keep selection and occurrence insertion under the same row lock.
      const tasks = await manager
        .getRepository(ScheduledTaskSchema)
        .createQueryBuilder("task")
        .where({
          ...this.owner,
          deleted_at: IsNull(),
          enabled: true,
          next_start_at: Raw((alias) => `${alias} <= now()`),
        })
        .orderBy("task.next_start_at", "ASC")
        .take(10)
        .setLock("pessimistic_write")
        .setOnLocked("skip_locked")
        .getMany();
      for (const row of tasks) {
        const now = Date.now();
        let at: Date | null = row.next_start_at!;
        let running = await manager.getRepository(ScheduledRunSchema).existsBy({
          schedule_id: row.id,
          workspace_id: row.workspace_id,
          state: In(active),
        });
        // Preserve each missed slot in the calendar after downtime, bounded per
        // transaction. Do not skip a still-valid slot by jumping directly to now.
        for (let count = 0; at && at.getTime() <= now && count < 32; count++) {
          const expired =
            now - at.getTime() > row.definition.startWindowMinutes * 60000;
          const state = expired || running ? "missed" : "queued";
          const error = expired
            ? "已超出允许启动窗口，未补发过期工作"
            : running
              ? "上一期尚未结束，本期未重叠执行"
              : null;
          await this.schedules.insertRun(manager, row, at, false, state, error);
          if (state === "queued") running = true;
          const next = nextScheduleStart(
            row.definition.rule,
            new Date(at.getTime() + 1000).toISOString(),
          );
          at = next ? new Date(next) : null;
        }
        await manager.getRepository(ScheduledTaskSchema).update(
          { id: row.id, ...this.owner },
          {
            next_start_at: at,
            enabled: Boolean(at),
          },
        );
      }
    });
  }
  private async collectRuns() {
    await this.due();
    await this.schedules.syncNotices();
    const runs = await this.schedules
      .ownedRuns()
      .andWhere("run.state IN (:...active)", { active })
      .orderBy("run.created_at", "ASC")
      .take(100)
      .getMany();
    return runs.map((run) => ({ id: run.id, workspaceId: run.workspace_id }));
  }
  private async observeRun(id: string) {
    const run = await this.schedules
      .ownedRuns()
      .andWhere("run.id=:id", { id })
      .getOne();
    if (!run) return true;
    if (!active.includes(run.state)) return true;
    if (run.next_observe_at && run.next_observe_at.getTime() > Date.now())
      return false;
    const age = Date.now() - run.scheduled_at.getTime();
    if (!run.event_id && age > run.snapshot.startWindowMinutes * 60000) {
      await this.db.getRepository(ScheduledRunSchema).update(
        { id: run.id, workspace_id: run.workspace_id },
        {
          state: "missed",
          error: "等待执行超出启动窗口，未发送过期工作",
          lease_until: null,
          updated_at: () => "now()",
        },
      );
      return true;
    }
    try {
      await this.contexts.authorizeRun(runView(run).authority);
    } catch {
      await this.db.getRepository(ScheduledRunSchema).update(
        { id: run.id, workspace_id: run.workspace_id },
        {
          state: "blocked",
          error: "执行身份或连接授权不再可用；保留原运行，未改用其他连接",
          lease_until: null,
          updated_at: () => "now()",
        },
      );
      return false;
    }
    try {
      const update = await this.host.observeScheduledRun({
        id: run.id,
        workspaceId: run.workspace_id,
        runAsUserId: run.run_as_user_id,
      });
      // Conditional updates preserve terminal states and the original native run.
      const changed = await this.db
        .createQueryBuilder()
        .update(ScheduledRunSchema)
        .set({
          state: update.state,
          observe_attempts: 0,
          next_observe_at: null,
          run_id: () => 'COALESCE(:runId::uuid, "run_id")',
          reply_event_id: () =>
            'COALESCE(:replyEventId::text, "reply_event_id")',
          error: update.error,
          lease_until: null,
          updated_at: () => "now()",
        })
        .where({ id: run.id, workspace_id: run.workspace_id })
        .andWhere("state NOT IN (:...terminal)", {
          terminal: scheduleTerminalStates,
        })
        .andWhere(
          "(run_id IS NULL OR :runId::uuid IS NULL OR run_id=:runId::uuid)",
        )
        .setParameters({
          runId: update.runId,
          replyEventId: update.replyEventId,
        })
        .execute();
      return (
        Boolean(changed.affected) &&
        scheduleTerminalStates.includes(update.state)
      );
    } catch (error) {
      const attempts = run.observe_attempts + 1;
      console.error(
        JSON.stringify({
          event: "schedule_observation_unconfirmed",
          occurrenceId: id,
          runId: run.run_id,
          attempts,
          code: publicError(error).code,
        }),
      );
      await this.db.getRepository(ScheduledRunSchema).update(
        { id: run.id, workspace_id: run.workspace_id },
        {
          state: run.event_id ? "unknown" : "blocked",
          observe_attempts: attempts,
          next_observe_at: observationBackoff(attempts),
          error: "执行服务响应未确认；保留原请求，稍后沿同一记录观察",
          lease_until: null,
          updated_at: () => "now()",
        },
      );
    }
    return false;
  }
}
