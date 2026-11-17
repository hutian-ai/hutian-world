import {
  runtimeDisplayLabel,
  scheduleCalendarQuery,
  scheduleInput,
  type ScheduleCalendarItem,
  type ScheduleInput,
  type ScheduledInbox,
  type ScheduledNoticeChange,
  type ScheduledRun,
  type ScheduledRunNotice,
} from "@hutian-world/contracts";
import { nextScheduleStart } from "@hutian-world/contracts/schedule-time";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { DataSource, In, IsNull, Raw, type EntityManager } from "typeorm";
import type { z } from "zod";
import { scheduleActiveStates as active } from "../../common/execution-policy.js";
import { readDatabaseCursor, writeCursor } from "../../common/pagination.js";
import { AccessContexts } from "../access/access-context.service.js";
import { RuntimeDevicesService } from "../runtime-devices/runtime-devices.service.js";
import { ScheduleNoticesRepository } from "./schedule-notices.repository.js";

import { RoleRuntimeSchema } from "../roles/entities/role-runtime.schema.js";
import { RoleSchema } from "../roles/entities/role.schema.js";
import {
  ScheduledRunSchema,
  ScheduledTaskSchema,
} from "./entities/schedule.schema.js";
import {
  authority,
  runView,
  taskView,
  type RunRow,
  type TaskRow,
} from "./schedules.mapper.js";
@Injectable()
export class SchedulesService {
  constructor(
    @Inject(ScheduleNoticesRepository)
    private readonly notices: ScheduleNoticesRepository,
    @Inject(RuntimeDevicesService)
    private readonly deviceNames: RuntimeDevicesService,
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  private get owner() {
    const c = this.contexts.current();
    return {
      creator_id: c.creatorId,
      workspace_id: c.workspaceId,
      created_by_user_id: c.userId,
    };
  }
  ownedRuns(manager: EntityManager = this.db.manager) {
    const c = this.contexts.current();
    return manager
      .getRepository(ScheduledRunSchema)
      .createQueryBuilder("run")
      .innerJoin(
        ScheduledTaskSchema.options.name,
        "task",
        "task.id=run.schedule_id AND task.workspace_id=run.workspace_id",
      )
      .where(
        "task.creator_id=:creatorId AND task.workspace_id=:workspaceId AND task.created_by_user_id=:userId",
        {
          creatorId: c.creatorId,
          workspaceId: c.workspaceId,
          userId: c.userId,
        },
      );
  }
  private async ownedTask(
    id: string,
    manager: EntityManager = this.db.manager,
    lock = false,
  ) {
    return manager.getRepository(ScheduledTaskSchema).findOne({
      where: { ...this.owner, id },
      ...(lock ? { lock: { mode: "pessimistic_write" as const } } : {}),
    });
  }
  async list() {
    const tasks = await this.db.getRepository(ScheduledTaskSchema).find({
      where: { ...this.owner, deleted_at: IsNull() },
      order: { created_at: "ASC", id: "ASC" },
    });
    const page = await this.runPage();
    return {
      tasks: tasks.map(taskView),
      runs: page.items,
      nextCursor: page.nextCursor,
      worker: "api",
      limit: 50,
    };
  }
  async getTask(id: string) {
    const row = await this.ownedTask(id);
    if (!row) throw new NotFoundException("定时任务不存在或不可访问");
    const page = await this.runPage(id);
    return {
      task: taskView(row),
      runs: page.items,
      nextCursor: page.nextCursor,
    };
  }
  async runPage(scheduleId?: string, cursor?: string) {
    const after = readDatabaseCursor(cursor),
      query = this.ownedRuns();
    if (scheduleId) {
      if (!(await this.ownedTask(scheduleId)))
        throw new NotFoundException("定时任务不存在或不可访问");
      query.andWhere("run.schedule_id=:scheduleId", { scheduleId });
    }
    if (after)
      query.andWhere(
        "(date_trunc('milliseconds',run.created_at),run.id) < (:at::timestamptz,:id::uuid)",
        after,
      );
    const rows = await query
      .orderBy("date_trunc('milliseconds',run.created_at)", "DESC")
      .addOrderBy("run.id", "DESC")
      .limit(51)
      .getMany();
    const items = rows.slice(0, 50),
      last = items.at(-1);
    return {
      items: items.map(runView),
      nextCursor:
        rows.length > 50 && last
          ? writeCursor(last.created_at.toISOString(), last.id)
          : null,
      hasMore: rows.length > 50,
    };
  }

  async remove(id: string, expected: number) {
    return this.db.transaction(async (manager) => {
      const row = await this.ownedTask(id, manager, true);
      if (!row) throw new NotFoundException("定时任务不存在或不可访问");
      if (row.deleted_at) return { deleted: true };
      if (row.revision !== expected)
        throw new ConflictException("任务已变更，请重新读取后删除");
      await manager.getRepository(ScheduledTaskSchema).update(
        { ...this.owner, id },
        {
          deleted_at: () => "now()",
          enabled: false,
          next_start_at: null,
          revision: () => "revision+1",
          updated_at: () => "now()",
        },
      );
      return { deleted: true };
    });
  }
  async calendar(input: z.infer<typeof scheduleCalendarQuery>) {
    return this.db.transaction("REPEATABLE READ", async (manager) => {
      const rows = await manager
        .getRepository(ScheduledTaskSchema)
        .find({ where: this.owner, order: { id: "ASC" } });
      const matches = (title: string, roleId: string, status: string) =>
        (!input.query ||
          title
            .toLocaleLowerCase()
            .includes(input.query.toLocaleLowerCase())) &&
        (!input.roleId || roleId === input.roleId) &&
        (input.status === "all" || input.status === status);
      const tasks = rows
        .map(taskView)
        .filter(
          (task) =>
            (!input.scheduleId || task.id === input.scheduleId) &&
            matches(task.title, task.roleId, task.status),
        );
      const ids = tasks.map((task) => task.id);
      const runs: RunRow[] = ids.length
        ? await manager.getRepository(ScheduledRunSchema).find({
            where: {
              schedule_id: In(ids),
              workspace_id: this.contexts.current().workspaceId,
              scheduled_at: Raw(
                (alias) => `${alias} >= :from AND ${alias} < :to`,
                { from: input.from, to: input.to },
              ),
            },
            order: { scheduled_at: "ASC" },
            take: 1001,
          })
        : [];
      if (runs.length > 1000)
        throw new BadRequestException(
          "当前范围记录过多，请缩小日期范围或按成员筛选",
        );
      const items: ScheduleCalendarItem[] = runs.map((run) => ({
        id: run.id,
        scheduleId: run.schedule_id,
        runId: run.id,
        title: run.snapshot.title,
        at: run.scheduled_at.toISOString(),
        kind: "run",
        state: run.state,
        roleId: run.snapshot.roleId,
      }));
      const slots = new Set(
        runs
          .filter((run) => !run.manual)
          .map((run) => `${run.schedule_id}:${run.scheduled_at.toISOString()}`),
      );
      const now = Date.now();
      for (const task of tasks.filter(
        (task) => task.enabled && !task.deletedAt,
      )) {
        // Keep a due slot visible until the worker materializes its run.
        const lower = Math.max(
          Date.parse(input.from),
          Math.min(now, task.nextStartAt ? Date.parse(task.nextStartAt) : now),
        );
        let from = new Date(lower).toISOString();
        while (true) {
          const next = nextScheduleStart(task.rule, from);
          if (!next || Date.parse(next) >= Date.parse(input.to)) break;
          const at = new Date(next).toISOString();
          if (!slots.has(`${task.id}:${at}`))
            items.push({
              id: `${task.id}:${at}`,
              scheduleId: task.id,
              runId: null,
              title: task.title,
              at,
              kind: "expected",
              state: null,
              roleId: task.roleId,
            });
          if (items.length > 1000)
            throw new BadRequestException(
              "当前范围安排过多，请切换到周视图或按成员筛选",
            );
          from = new Date(Date.parse(next) + 1000).toISOString();
        }
      }
      return {
        items: items.sort((a, b) => a.at.localeCompare(b.at)),
        timeZone: "Asia/Shanghai",
      };
    });
  }
  async save(input: ScheduleInput, expected: number | null) {
    return this.db.transaction(async (manager) => {
      const c = this.contexts.current();
      const role = await manager.getRepository(RoleSchema).findOne({
        where: { id: input.roleId, ...this.contexts.scope },
        lock: { mode: "pessimistic_write" },
      });
      if (!role) throw new NotFoundException("成员不存在或不可访问");
      const existing = await this.ownedTask(input.id, manager, true);
      if (existing?.deleted_at)
        throw new ConflictException("该任务已删除，不能修改或重新启用");
      if (!existing && expected !== null)
        throw new NotFoundException("定时安排不存在");
      if (existing && expected === null) {
        if (
          !isDeepStrictEqual(
            scheduleInput.strip().parse(existing.definition),
            input,
          )
        )
          throw new ConflictException("该保存请求已经使用，请核对原安排");
        return taskView(existing);
      }
      if (existing && existing.revision !== expected)
        throw new ConflictException("安排已变更，请重新读取后保存");
      if (
        existing &&
        existing.definition.sourceAutomationId !== input.sourceAutomationId
      )
        throw new ConflictException("不能替换原迁移来源");
      if (existing)
        await this.contexts.authorizeRun({
          ...authority(existing),
          requestedByUserId: c.userId,
        });
      const next = input.enabled
        ? nextScheduleStart(input.rule, new Date().toISOString())
        : null;
      if (input.enabled && !next)
        throw new BadRequestException(
          "此规则已没有未来执行时间，请调整日期后启用",
        );
      const repository = manager.getRepository(ScheduledTaskSchema);
      if (existing) {
        await repository.update(
          { ...this.owner, id: input.id },
          {
            definition: input,
            role_id: input.roleId,
            enabled: input.enabled,
            next_start_at: next ? new Date(next) : null,
            revision: () => "revision+1",
            updated_at: () => "clock_timestamp()",
          },
        );
      } else {
        await repository.insert({
          id: input.id,
          ...this.owner,
          role_id: input.roleId,
          definition: input,
          enabled: input.enabled,
          source_automation_id: input.sourceAutomationId,
          next_start_at: next ? new Date(next) : null,
          run_as_user_id: c.userId,
          communication_connection_id: c.connections.matrix,
          runtime_connection_id: c.connections.dock,
        });
      }
      const row = await repository.findOneByOrFail({
        ...this.owner,
        id: input.id,
      });
      return taskView(row);
    });
  }
  async setEnabled(id: string, enabled: boolean, expected: number) {
    const row = await this.ownedTask(id);
    if (!row) throw new NotFoundException("定时安排不存在");
    return this.save(
      { ...scheduleInput.strip().parse(row.definition), enabled },
      expected,
    );
  }
  async insertRun(
    manager: EntityManager,
    task: TaskRow,
    at: Date,
    manual: boolean,
    state: ScheduledRun["state"],
    error: string | null,
    id: string = randomUUID(),
  ) {
    const binding = await manager.getRepository(RoleRuntimeSchema).findOneBy({
      roleId: task.role_id,
      workspaceId: task.workspace_id,
    });
    const names = await this.deviceNames.list(manager);
    const snapshot = {
      ...scheduleInput.strip().parse(task.definition),
      conversationMode: "per_run" as const,
      roomId: null,
      runtime: binding
        ? {
            nodeId: binding.nodeId,
            provider: binding.provider,
            label: runtimeDisplayLabel(
              binding.nodeId,
              binding.provider,
              names.settings.find((n) => n.nodeId === binding.nodeId)
                ?.customName,
            ),
            preferences: binding.preferences,
            updatedAt: binding.updatedAt.toISOString(),
          }
        : null,
    };
    // Partial unique slot index remains the authority for duplicate occurrences.
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(ScheduledRunSchema)
      .values({
        id,
        schedule_id: task.id,
        scheduled_at: at,
        manual,
        snapshot,
        state,
        error,
        workspace_id: task.workspace_id,
        requested_by_user_id: this.contexts.current().userId,
        run_as_user_id: task.run_as_user_id,
        communication_connection_id: task.communication_connection_id,
        runtime_connection_id: task.runtime_connection_id,
      })
      .orIgnore()
      .returning("id")
      .execute();
    const run = result.raw.length
      ? await manager
          .getRepository(ScheduledRunSchema)
          .findOneByOrFail({ id, workspace_id: task.workspace_id })
      : null;
    return run;
  }
  async runNow(id: string, requestId: string) {
    return this.db.transaction(async (manager) => {
      const task = await this.ownedTask(id, manager, true);
      if (!task) throw new NotFoundException("定时安排不存在");
      if (task.deleted_at)
        throw new ConflictException("该任务已删除，不能启动新的运行");
      const existing = await manager
        .getRepository(ScheduledRunSchema)
        .findOneBy({
          id: requestId,
          workspace_id: task.workspace_id,
          requested_by_user_id: this.contexts.current().userId,
        });
      if (existing) {
        if (existing.schedule_id !== id)
          throw new ConflictException("此运行请求已用于其他安排");
        return runView(existing);
      }
      await this.contexts.authorizeRun({
        ...authority(task),
        requestedByUserId: this.contexts.current().userId,
      });
      const running = await manager.getRepository(ScheduledRunSchema).existsBy({
        schedule_id: id,
        workspace_id: task.workspace_id,
        state: In(active),
      });
      if (running)
        throw new ConflictException("该安排已有未结束的运行，请先核对原记录");
      const run = await this.insertRun(
        manager,
        task,
        new Date(),
        true,
        "queued",
        null,
        requestId,
      );
      if (!run) throw new ConflictException("运行请求已存在，请核对原请求");
      return runView(run);
    });
  }
  async getRun(id: string) {
    const run = await this.ownedRuns()
      .andWhere("run.id = :id", { id })
      .getOne();
    if (!run) throw new NotFoundException("运行不存在或不可访问");
    return runView(run);
  }
  async syncNotices() {
    return this.notices.syncNotices();
  }
  async inbox(
    filter: "all" | "unread" | "attention" = "all",
    cursor?: string,
  ): Promise<ScheduledInbox> {
    const [counts, page] = await Promise.all([
      this.notices.counts(),
      this.notices.list(filter, cursor),
    ]);
    const notices = page.records;
    const runs = notices.length
      ? await this.ownedRuns()
          .andWhere("run.id IN (:...ids)", { ids: notices.map((n) => n.id) })
          .getMany()
      : [];
    const mapped = new Map(runs.map((run) => [run.id, runView(run)]));
    return {
      ...counts,
      nextCursor: page.nextCursor,
      notices: notices.flatMap((n) => {
        const run = mapped.get(n.id);
        return run
          ? [
              {
                id: n.id,
                kind: n.kind,
                readAt: n.read_at?.toISOString() ?? null,
                resolvedAt: n.resolved_at?.toISOString() ?? null,
                updatedAt: n.updated_at.toISOString(),
                run,
              },
            ]
          : [];
      }),
    };
  }
  async notice(id: string): Promise<ScheduledRunNotice | null> {
    const run = await this.getRun(id);
    const notice = await this.notices.get(id);
    return notice
      ? {
          id,
          run,
          kind: notice.kind,
          readAt: notice.read_at?.toISOString() ?? null,
          resolvedAt: notice.resolved_at?.toISOString() ?? null,
          updatedAt: notice.updated_at.toISOString(),
        }
      : null;
  }
  async markNotice(
    id: string,
    action: "read" | "unread" | "done",
    updatedAt: string,
  ) {
    const run = await this.getRun(id);
    if (action === "done" && !["failed", "missed"].includes(run.state))
      throw new ConflictException(
        "此事项需要按原运行状态处理，不能通过已处理替代授权或执行。",
      );
    return this.notices.markNotice(id, action, updatedAt);
  }
  async undoNotice(change: ScheduledNoticeChange) {
    const run = await this.getRun(change.id);
    if (
      change.field === "resolvedAt" &&
      !["failed", "missed"].includes(run.state)
    )
      throw new ConflictException("运行状态已变化，不能撤销原处理标记。");
    return this.notices.undoNotice(change);
  }
  async recordRoom(id: string, roomId: string) {
    const run = await this.getRun(id);
    await this.contexts.authorizeRun(run.authority);
    const result = await this.db
      .createQueryBuilder()
      .update(ScheduledRunSchema)
      .set({
        snapshot: () =>
          `jsonb_set(snapshot, '{roomId}', to_jsonb(:roomId::text))`,
      })
      .where({ id, workspace_id: run.authority.workspaceId })
      .andWhere(
        "(snapshot->>'roomId' IS NULL OR snapshot->>'roomId' = :roomId)",
        { roomId },
      )
      .execute();
    if (!result.affected)
      throw new ConflictException("本次工作已经关联其他对话，未替换。");
    return this.getRun(id);
  }
  async workRooms() {
    const rows = await this.ownedRuns()
      .select("run.snapshot->>'roomId'", "roomId")
      .andWhere("run.snapshot->>'conversationMode' = 'per_run'")
      .andWhere("run.snapshot->>'roomId' IS NOT NULL")
      .getRawMany<{ roomId: string }>();
    return rows.map((row) => row.roomId);
  }
  async recordEvent(id: string, eventId: string) {
    const run = await this.getRun(id);
    await this.contexts.authorizeRun(run.authority);
    const result = await this.db
      .createQueryBuilder()
      .update(ScheduledRunSchema)
      .set({ event_id: eventId, updated_at: () => "clock_timestamp()" })
      .where({ id, workspace_id: run.authority.workspaceId })
      .andWhere("(event_id IS NULL OR event_id = :eventId)", { eventId })
      .execute();
    const row = result.affected
      ? await this.db
          .getRepository(ScheduledRunSchema)
          .findOneBy({ id, workspace_id: run.authority.workspaceId })
      : null;
    if (!row) throw new ConflictException("运行已关联其他原消息，未替换");
    return runView(row);
  }
}
