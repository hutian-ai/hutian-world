import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { nextScheduleStart } from "@hutian-world/contracts/schedule-time";
import { type ScheduleInput, type ScheduledTask, type ScheduledRun, type ScheduleCalendarItem, scheduleCalendarQuery } from "@hutian-world/contracts";
import type { z } from "zod";
import type { Environment } from "./environment.js";

type TaskRow = { id: string; definition: ScheduleInput; revision: number; enabled: boolean; next_start_at: Date | null; deleted_at: Date | null; created_at: Date; updated_at: Date };
type RunRow = { id: string; schedule_id: string; scheduled_at: Date; manual: boolean; state: ScheduledRun["state"]; snapshot: ScheduleInput; event_id: string | null; run_id: string | null; reply_event_id: string | null; error: string | null; created_at: Date; updated_at: Date };
const taskView = (r: TaskRow): ScheduledTask => ({ ...r.definition, id: r.id, enabled: r.enabled, status: r.deleted_at ? "deleted" : r.enabled ? "active" : nextScheduleStart(r.definition.rule, new Date().toISOString()) ? "paused" : "ended", revision: r.revision, nextStartAt: r.next_start_at?.toISOString() ?? null, deletedAt: r.deleted_at?.toISOString() ?? null, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() });
const runView = (r: RunRow): ScheduledRun => ({ id: r.id, scheduleId: r.schedule_id, scheduledAt: r.scheduled_at.toISOString(), manual: r.manual, state: r.state, snapshot: r.snapshot, eventId: r.event_id, runId: r.run_id, replyEventId: r.reply_event_id, error: r.error, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString() });
function returningRows<T>(value: unknown): T[] {
  const rows = value as unknown[];
  return (Array.isArray(rows[0]) ? rows[0] : rows) as T[];
}
const active = ['queued', 'preparing', 'running', 'blocked', 'unknown'];
@Injectable()
export class SchedulesService {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(@Inject(DataSource) private readonly db: DataSource, @Inject("ENV") private readonly env: Environment) {}
  onModuleInit() { this.timer = setInterval(() => { void this.tick(); }, 15000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async list() {
    const tasks: TaskRow[] = await this.db.query("SELECT * FROM scheduled_tasks WHERE creator_id=$1 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 100", [this.env.HUTIAN_CREATOR_ID]);
    const runs: RunRow[] = await this.db.query(`SELECT r.* FROM scheduled_runs r JOIN scheduled_tasks s ON s.id=r.schedule_id WHERE s.creator_id=$1 ORDER BY r.created_at DESC LIMIT 100`, [this.env.HUTIAN_CREATOR_ID]);
    return { tasks: tasks.map(taskView), runs: runs.map(runView), worker: "api", limit: 100 };
  }
  async getTask(id: string) {
    const [row]: TaskRow[] = await this.db.query("SELECT * FROM scheduled_tasks WHERE id=$1 AND creator_id=$2", [id, this.env.HUTIAN_CREATOR_ID]);
    if (!row) throw new NotFoundException("定时任务不存在或不可访问");
    const runs: RunRow[] = await this.db.query("SELECT * FROM scheduled_runs WHERE schedule_id=$1 ORDER BY created_at DESC LIMIT 100", [id]);
    return { task: taskView(row), runs: runs.map(runView) };
  }
  async remove(id: string, expected: number) {
    return this.db.transaction(async manager => {
      const [row]: TaskRow[] = await manager.query("SELECT * FROM scheduled_tasks WHERE id=$1 AND creator_id=$2 FOR UPDATE", [id, this.env.HUTIAN_CREATOR_ID]);
      if (!row) throw new NotFoundException("定时任务不存在或不可访问");
      if (row.deleted_at) return { deleted: true };
      if (row.revision !== expected) throw new ConflictException("任务已变更，请重新读取后删除");
      await manager.query("UPDATE scheduled_tasks SET deleted_at=now(),enabled=false,next_start_at=NULL,revision=revision+1,updated_at=now() WHERE id=$1", [id]);
      return { deleted: true };
    });
  }
  async calendar(input: z.infer<typeof scheduleCalendarQuery>) {
    return this.db.transaction("REPEATABLE READ", async manager => {
      const rows: TaskRow[] = await manager.query("SELECT * FROM scheduled_tasks WHERE creator_id=$1 ORDER BY id", [this.env.HUTIAN_CREATOR_ID]);
      const matches = (title: string, roleId: string, status: string) => (!input.query || title.toLocaleLowerCase().includes(input.query.toLocaleLowerCase())) && (!input.roleId || roleId === input.roleId) && (input.status === "all" || input.status === status);
      const tasks = rows.map(taskView).filter(task => (!input.scheduleId || task.id === input.scheduleId) && matches(task.title, task.roleId, task.status));
      const ids = tasks.map(task => task.id);
      const runs: RunRow[] = ids.length ? await manager.query("SELECT * FROM scheduled_runs WHERE schedule_id=ANY($1::uuid[]) AND scheduled_at >= $2 AND scheduled_at < $3 ORDER BY scheduled_at LIMIT 1001", [ids, input.from, input.to]) : [];
      if (runs.length > 1000) throw new BadRequestException("当前范围记录过多，请缩小日期范围或按成员筛选");
      const items: ScheduleCalendarItem[] = runs.map(run => ({ id: run.id, scheduleId: run.schedule_id, runId: run.id, title: run.snapshot.title, at: run.scheduled_at.toISOString(), kind: "run", state: run.state, roleId: run.snapshot.roleId }));
      const slots = new Set(runs.filter(run => !run.manual).map(run => `${run.schedule_id}:${run.scheduled_at.toISOString()}`));
      const lower = Math.max(Date.parse(input.from), Date.now());
      for (const task of tasks.filter(task => task.enabled && !task.deletedAt)) {
        let from = new Date(lower).toISOString();
        while (true) {
          const next = nextScheduleStart(task.rule, from);
          if (!next || Date.parse(next) >= Date.parse(input.to)) break;
          const at = new Date(next).toISOString();
          if (!slots.has(`${task.id}:${at}`)) items.push({ id: `${task.id}:${at}`, scheduleId: task.id, runId: null, title: task.title, at, kind: "expected", state: null, roleId: task.roleId });
          if (items.length > 1000) throw new BadRequestException("当前范围安排过多，请切换到周视图或按成员筛选");
          from = new Date(Date.parse(next) + 1000).toISOString();
        }
      }
      return { items: items.sort((a, b) => a.at.localeCompare(b.at)), timeZone: "Asia/Shanghai" };
    });
  }
  async save(input: ScheduleInput, expected: number | null) {
    return this.db.transaction(async manager => {
      const creatorId = this.env.HUTIAN_CREATOR_ID;
      const [role] = await manager.query("SELECT id FROM roles WHERE id=$1 AND creator_id=$2 FOR UPDATE", [input.roleId, creatorId]);
      if (!role) throw new NotFoundException("成员不存在或不可访问");
      const [existing]: TaskRow[] = await manager.query("SELECT * FROM scheduled_tasks WHERE id=$1 AND creator_id=$2 FOR UPDATE", [input.id, creatorId]);
      if (existing?.deleted_at) throw new ConflictException("该任务已删除，不能修改或重新启用");
      if (!existing && expected !== null) throw new NotFoundException("定时安排不存在");
      if (existing && expected === null) {
        if (!isDeepStrictEqual(existing.definition, input)) throw new ConflictException("该保存请求已经使用，请核对原安排");
        return taskView(existing);
      }
      if (existing && existing.revision !== expected) throw new ConflictException("安排已变更，请重新读取后保存");
      if (existing && existing.definition.sourceAutomationId !== input.sourceAutomationId) throw new ConflictException("不能替换原迁移来源");
      const next = input.enabled ? nextScheduleStart(input.rule, new Date().toISOString()) : null;
      if (input.enabled && !next) throw new BadRequestException("此规则已没有未来执行时间，请调整日期后启用");
      let row: TaskRow;
      if (existing) [row] = returningRows<TaskRow>(await manager.query(`UPDATE scheduled_tasks SET definition=$1, role_id=$2, enabled=$3, next_start_at=$4, revision=revision+1, updated_at=clock_timestamp() WHERE id=$5 RETURNING *`, [input, input.roleId, input.enabled, next, input.id]));
      else [row] = await manager.query(`INSERT INTO scheduled_tasks(id,creator_id,role_id,definition,enabled,source_automation_id,next_start_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [input.id, creatorId, input.roleId, input, input.enabled, input.sourceAutomationId, next]);
      return taskView(row!);
    });
  }
  async setEnabled(id: string, enabled: boolean, expected: number) {
    const [row]: TaskRow[] = await this.db.query("SELECT * FROM scheduled_tasks WHERE id=$1 AND creator_id=$2", [id, this.env.HUTIAN_CREATOR_ID]);
    if (!row) throw new NotFoundException("定时安排不存在");
    return this.save({ ...row.definition, enabled }, expected);
  }
  async runNow(id: string, requestId: string) {
    return this.db.transaction(async manager => {
      const [task]: TaskRow[] = await manager.query("SELECT * FROM scheduled_tasks WHERE id=$1 AND creator_id=$2 FOR UPDATE", [id, this.env.HUTIAN_CREATOR_ID]);
      if (!task) throw new NotFoundException("定时安排不存在");
      if (task.deleted_at) throw new ConflictException("该任务已删除，不能启动新的运行");
      const [existing]: RunRow[] = await manager.query("SELECT * FROM scheduled_runs WHERE id=$1", [requestId]);
      if (existing) { if (existing.schedule_id !== id) throw new ConflictException("此运行请求已用于其他安排"); return runView(existing); }
      const [running]: RunRow[] = await manager.query("SELECT * FROM scheduled_runs WHERE schedule_id=$1 AND state=ANY($2)", [id, active]);
      if (running) throw new ConflictException("该安排已有未结束的运行，请先核对原记录");
      const [run]: RunRow[] = await manager.query(`INSERT INTO scheduled_runs(id,schedule_id,scheduled_at,manual,snapshot,state) VALUES($1,$2,now(),true,$3,'queued') RETURNING *`, [requestId, id, task.definition]);
      return runView(run!);
    });
  }
  async getRun(id: string) {
    const [run]: RunRow[] = await this.db.query("SELECT r.* FROM scheduled_runs r JOIN scheduled_tasks s ON s.id=r.schedule_id WHERE r.id=$1 AND s.creator_id=$2", [id, this.env.HUTIAN_CREATOR_ID]);
    if (!run) throw new NotFoundException("运行不存在或不可访问");
    return runView(run);
  }
  async recordEvent(id: string, eventId: string) {
    await this.getRun(id);
    const [row] = returningRows<RunRow>(await this.db.query(`UPDATE scheduled_runs SET event_id=$1, updated_at=clock_timestamp() WHERE id=$2 AND (event_id IS NULL OR event_id=$1) RETURNING *`, [eventId, id]));
    if (!row) throw new ConflictException("运行已关联其他原消息，未替换");
    return runView(row);
  }
  private async due() {
    await this.db.transaction(async manager => {
      const tasks: TaskRow[] = await manager.query("SELECT * FROM scheduled_tasks WHERE creator_id=$1 AND deleted_at IS NULL AND enabled AND next_start_at<=now() ORDER BY next_start_at FOR UPDATE SKIP LOCKED LIMIT 10", [this.env.HUTIAN_CREATOR_ID]);
      for (const row of tasks) {
        const now = Date.now(), at = row.next_start_at!;
        const expired = now - at.getTime() > row.definition.startWindowMinutes * 60000;
        const [running] = await manager.query("SELECT id FROM scheduled_runs WHERE schedule_id=$1 AND state=ANY($2) LIMIT 1", [row.id, active]);
        const state = expired || running ? "missed" : "queued";
        const error = expired ? "已超出允许启动窗口，未补发过期工作" : running ? "上一期尚未结束，本期未重叠执行" : null;
        await manager.query(`INSERT INTO scheduled_runs(id,schedule_id,scheduled_at,snapshot,state,error) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [randomUUID(), row.id, at, row.definition, state, error]);
        const next = nextScheduleStart(row.definition.rule, new Date(now + 1000).toISOString());
        await manager.query("UPDATE scheduled_tasks SET next_start_at=$1, enabled=$2 WHERE id=$3", [next, Boolean(next), row.id]);
      }
    });
  }
  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.due();
      // A short lease fences multiple API processes. Re-entry always uses the same occurrence/message/run.
      const runs: RunRow[] = await this.db.transaction(async manager => {
        const rows: RunRow[] = await manager.query(`SELECT r.* FROM scheduled_runs r JOIN scheduled_tasks s ON s.id=r.schedule_id WHERE s.creator_id=$1 AND r.state=ANY($2) AND (r.lease_until IS NULL OR r.lease_until<now()) ORDER BY r.created_at FOR UPDATE OF r SKIP LOCKED LIMIT 10`, [this.env.HUTIAN_CREATOR_ID, active]);
        for (const r of rows) await manager.query("UPDATE scheduled_runs SET lease_until=now()+interval '60 seconds' WHERE id=$1", [r.id]);
        return rows;
      });
      for (const run of runs) {
        const age = Date.now() - run.scheduled_at.getTime();
        if (!run.event_id && age > run.snapshot.startWindowMinutes * 60000) {
          await this.db.query("UPDATE scheduled_runs SET state='missed', error=$1,lease_until=NULL,updated_at=now() WHERE id=$2", ["等待执行超出启动窗口，未发送过期工作", run.id]); continue;
        }
        try {
          const response = await fetch("http://127.0.0.1:3340/api/scheduled-runs", {
            method: "POST", redirect: "error", signal: AbortSignal.timeout(45000),
            headers: { authorization: `Bearer ${this.env.HUTIAN_API_TOKEN}`, "content-type": "application/json" },
            body: JSON.stringify({ id: run.id }),
          });
          if (!response.ok) throw new Error("delivery_unconfirmed");
          const value = await response.json();
          const { scheduledRunUpdate } = await import("@hutian-world/contracts");
          const update = scheduledRunUpdate.parse(value);
          await this.db.query(`UPDATE scheduled_runs SET state=$1,run_id=COALESCE($2,run_id),reply_event_id=COALESCE($3,reply_event_id),error=$4,lease_until=NULL,updated_at=now() WHERE id=$5 AND state NOT IN ('replied','failed','missed','skipped') AND (run_id IS NULL OR $2::uuid IS NULL OR run_id=$2::uuid)`, [update.state, update.runId, update.replyEventId, update.error, run.id]);
        } catch {
          // Delivery may have been accepted. Keep the same ID and event; never invent a replacement run.
          await this.db.query("UPDATE scheduled_runs SET error=$1,lease_until=NULL,updated_at=now() WHERE id=$2", ["执行服务响应未确认；保留原请求，稍后沿同一记录观察", run.id]);
        }
      }
    } catch { console.error("定时安排检查未完成；未重建或替换原运行。"); }
    finally { this.busy = false; }
  }
}
