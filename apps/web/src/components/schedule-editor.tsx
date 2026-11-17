"use client";
import { useEffect, useRef, useState } from "react";
import Link, { useRouter } from "@/lib/navigation";
import { ChevronDown, Plus, Save, X } from "lucide-react";
import { PageNavigation } from "./page-navigation";
import { useBlocker } from "react-router-dom";
import { toast } from "sonner";
import {
  scheduleInput,
  scheduleRule,
  type ScheduleInput,
  type ScheduledTask,
  type ScheduleRule,
} from "@hutian-world/contracts";
import { previewScheduleRule, saveSchedule } from "@/lib/schedule-actions";
import {
  frequencyLabels,
  scheduleAt,
  scheduleHref,
  scheduleSummary,
} from "@/lib/schedule-display";
import { Button } from "@hutian-ai/design/ui/button";
import { Input } from "@hutian-ai/design/ui/input";
import { Textarea } from "@hutian-ai/design/ui/textarea";
import { Checkbox } from "@hutian-ai/design/ui/checkbox";
import { Switch } from "@hutian-ai/design/ui/switch";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@hutian-ai/design/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hutian-ai/design/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@hutian-ai/design/ui/toggle-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@hutian-ai/design/ui/collapsible";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@hutian-ai/design/ui/alert-dialog";

export type ScheduleEditorChoices = {
  roles: { id: string; name: string; configured: boolean }[];
};
export function ScheduleEditor({
  initial,
  initialDate,
  initialRoleId,
  returnTo,
  cancelTo,
  roles,
}: ScheduleEditorChoices & {
  initial: ScheduledTask | null;
  initialDate?: string;
  initialRoleId?: string;
  returnTo: string;
  cancelTo?: string;
}) {
  const router = useRouter();
  const [task, setTask] = useState<ScheduleInput>(() => {
    if (initial) return scheduleInput.strip().parse(initial);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return {
      id: crypto.randomUUID(),
      title: "",
      prompt: "",
      roleId:
        initialRoleId && roles.some((role) => role.id === initialRoleId)
          ? initialRoleId
          : "",
      rule: {
        startDate: initialDate || day,
        localTime: "09:00",
        additionalTimes: [],
        timeZone: "Asia/Shanghai",
        frequency: initialDate ? "once" : "weekly",
        interval: 1,
        weekdays: [1, 2, 3, 4, 5],
      },
      enabled: true,
      silentNoUpdate: false,
      useMemory: false,
      useKnowledge: false,
      timeoutMinutes: 30,
      startWindowMinutes: 60,
      sourceAutomationId: null,
    };
  });
  const original = useRef(JSON.stringify(task));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    starts: string[];
    error: string;
  } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      JSON.stringify(task) !== original.current &&
      currentLocation.pathname + currentLocation.search !==
        nextLocation.pathname + nextLocation.search,
  );
  const lock = useRef(false),
    dirty = JSON.stringify(task) !== original.current;
  const back = initial
    ? scheduleHref(initial.id, returnTo)
    : (cancelTo ?? returnTo);
  const patch = (value: Partial<ScheduleInput>) =>
    setTask((current) => ({ ...current, ...value }));
  const rulePatch = (value: Partial<ScheduleRule>) =>
    setTask((current) => ({ ...current, rule: { ...current.rule, ...value } }));
  const ruleKey = JSON.stringify(task.rule);
  useEffect(() => {
    setPreview(null);
    const parsed = scheduleRule.safeParse(JSON.parse(ruleKey));
    if (!parsed.success) {
      setPreview({
        starts: [],
        error: parsed.error.issues.some(
          (issue) => issue.message === "请选择执行星期",
        )
          ? "请选择执行星期"
          : "请填写有效的日期、时间和时区",
      });
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      void previewScheduleRule(parsed.data).then((value) => {
        if (current)
          setPreview(
            value.ok
              ? { starts: value.starts, error: "" }
              : { starts: [], error: value.error },
          );
      });
    }, 350);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [ruleKey]);
  useEffect(() => {
    if (error)
      document
        .getElementById("schedule-error")
        ?.scrollIntoView({ block: "center" });
  }, [error]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty]);
  async function save() {
    if (lock.current) return;
    if (!task.prompt.trim()) {
      setError("请写清这项任务每次要做什么");
      document.getElementById("schedule-prompt")?.focus();
      return;
    }
    if (!task.roleId) {
      setError("请选择负责成员");
      document.getElementById("schedule-member")?.focus();
      return;
    }
    const parsed = scheduleInput.safeParse({
      ...task,
      title:
        task.title.trim() || task.prompt.trim().split("\n")[0]!.slice(0, 60),
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((issue) =>
            issue.code === "custom"
              ? issue.message
              : "请检查运行时间与高级设置的填写",
          )
          .join("；"),
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await saveSchedule(parsed.data, initial?.revision ?? null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      original.current = JSON.stringify(task);
      toast.success(
        initial ? "任务已更新，后续运行使用新设置" : "定时任务已创建",
      );
      router.replace(scheduleHref(result.task.id, returnTo));
      router.refresh();
    } catch {
      setError("保存结果未确认，请保留当前草稿，重试会核对同一任务。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageNavigation
        items={[
          { label: "定时任务", href: returnTo },
          ...(initial
            ? [
                {
                  label: initial.title,
                  href: scheduleHref(initial.id, returnTo),
                },
                { label: "编辑" },
              ]
            : [{ label: "新建定时任务" }]),
        ]}
      />
      <header className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-4 border-b bg-background py-4">
        <h1 className="text-2xl font-semibold">
          {initial ? "编辑定时任务" : "新建定时任务"}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => router.push(back)}
          >
            {cancelTo && !initial ? "取消并返回成员" : "取消"}
          </Button>
          <Button type="submit" form="schedule-form" disabled={busy}>
            <Save />
            {busy ? "保存中…" : initial ? "保存修改" : "创建任务"}
          </Button>
        </div>
      </header>
      <form
        id="schedule-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <fieldset disabled={busy} className="min-w-0 space-y-7">
          {error && (
            <Alert id="schedule-error" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <section className="space-y-4">
            <Field>
              <FieldLabel htmlFor="schedule-member">负责成员</FieldLabel>
              <Select
                value={task.roleId || undefined}
                onValueChange={(roleId) => patch({ roleId })}
              >
                <SelectTrigger id="schedule-member" aria-label="负责成员">
                  <SelectValue placeholder="选择成员" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                      {!role.configured ? " · 待配置" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {task.roleId && (
                <FieldDescription>
                  {roles.find((role) => role.id === task.roleId)?.configured
                    ? "使用成员的执行配置。"
                    : "此成员尚未配置运行环境，配置后才能执行。"}
                  <Link
                    className="ml-2 underline underline-offset-4"
                    href={`/members/${task.roleId}?view=settings&section=runtime`}
                  >
                    成员设置
                  </Link>
                </FieldDescription>
              )}
            </Field>
            <p className="text-sm text-muted-foreground">
              结果与需要你处理的事项会出现在收件箱。
            </p>
          </section>
          <section className="space-y-4 border-t pt-6">
            <h2 className="text-sm font-semibold">工作内容</h2>
            <Field>
              <FieldLabel htmlFor="schedule-prompt">每次要做什么</FieldLabel>
              <Textarea
                id="schedule-prompt"
                autoFocus
                className="min-h-40 text-sm"
                value={task.prompt}
                placeholder="工作要求、参考资料，以及希望收到什么结果…"
                maxLength={15000}
                onChange={(event) => patch({ prompt: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="schedule-title">任务名称（可选）</FieldLabel>
              <Input
                id="schedule-title"
                value={task.title}
                placeholder="留空时从工作要求生成"
                maxLength={120}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </Field>
          </section>
          <section className="space-y-4 border-t pt-6">
            <h2 className="text-sm font-semibold">运行时间</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>重复</FieldLabel>
                <Select
                  value={task.rule.frequency}
                  onValueChange={(value) =>
                    rulePatch({
                      frequency: value as ScheduleRule["frequency"],
                      additionalTimes:
                        value === "once" ? [] : task.rule.additionalTimes,
                      weekdays: task.rule.weekdays ?? [1, 2, 3, 4, 5],
                      monthDay: task.rule.monthDay ?? 1,
                    })
                  }
                >
                  <SelectTrigger aria-label="周期">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(frequencyLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-date">
                  {task.rule.frequency === "once" ? "运行日期" : "开始日期"}
                </FieldLabel>
                <Input
                  id="schedule-date"
                  type="date"
                  value={task.rule.startDate}
                  onChange={(event) =>
                    rulePatch({ startDate: event.target.value })
                  }
                />
              </Field>
            </div>
            {task.rule.frequency === "weekly" && (
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>每周哪几天</FieldLabel>
                  <Button
                    type="button"
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => rulePatch({ weekdays: [1, 2, 3, 4, 5] })}
                  >
                    周一至周五
                  </Button>
                </div>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  size="sm"
                  value={(task.rule.weekdays ?? []).map(String)}
                  onValueChange={(values) =>
                    rulePatch({ weekdays: values.map(Number).sort() })
                  }
                  aria-label="执行星期"
                >
                  {["一", "二", "三", "四", "五", "六", "日"].map(
                    (day, index) => (
                      <ToggleGroupItem
                        key={day}
                        value={String(index + 1)}
                        aria-label={`周${day}`}
                      >
                        {day}
                      </ToggleGroupItem>
                    ),
                  )}
                </ToggleGroup>
              </Field>
            )}
            {task.rule.frequency === "monthly" && (
              <Field>
                <FieldLabel>每月哪一天</FieldLabel>
                <Select
                  value={String(task.rule.monthDay ?? 1)}
                  onValueChange={(value) =>
                    rulePatch({
                      monthDay: value === "last" ? "last" : Number(value),
                    })
                  }
                >
                  <SelectTrigger aria-label="每月执行日">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 31 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {i + 1} 日
                      </SelectItem>
                    ))}
                    <SelectItem value="last">最后一天</SelectItem>
                  </SelectContent>
                </Select>
                {typeof task.rule.monthDay === "number" &&
                  task.rule.monthDay > 28 && (
                    <FieldDescription>
                      当月不存在的日期会跳过。
                    </FieldDescription>
                  )}
              </Field>
            )}
            {task.rule.frequency === "interval_days" && (
              <Field>
                <FieldLabel htmlFor="schedule-interval">间隔天数</FieldLabel>
                <Input
                  id="schedule-interval"
                  type="number"
                  min={1}
                  max={365}
                  value={task.rule.interval}
                  onChange={(event) =>
                    rulePatch({ interval: Number(event.target.value) })
                  }
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="schedule-time">运行时间</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="schedule-time"
                  className="w-32"
                  type="time"
                  value={task.rule.localTime}
                  onChange={(event) =>
                    rulePatch({ localTime: event.target.value })
                  }
                />
                {task.rule.additionalTimes.map((time, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <Input
                      className="w-32"
                      type="time"
                      aria-label={`其他执行时间 ${index + 1}`}
                      value={time}
                      onChange={(event) =>
                        rulePatch({
                          additionalTimes: task.rule.additionalTimes.map(
                            (value, i) =>
                              i === index ? event.target.value : value,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`移除执行时间 ${index + 1}`}
                      onClick={() =>
                        rulePatch({
                          additionalTimes: task.rule.additionalTimes.filter(
                            (_, i) => i !== index,
                          ),
                        })
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
                {task.rule.frequency !== "once" &&
                  task.rule.additionalTimes.length < 7 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        rulePatch({
                          additionalTimes: [
                            ...task.rule.additionalTimes,
                            "18:00",
                          ],
                        })
                      }
                    >
                      <Plus />
                      添加时间
                    </Button>
                  )}
              </div>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="schedule-zone">时区</FieldLabel>
                <Input
                  id="schedule-zone"
                  value={task.rule.timeZone}
                  placeholder="Asia/Shanghai"
                  onChange={(event) =>
                    rulePatch({ timeZone: event.target.value })
                  }
                />
              </Field>
              {task.rule.frequency !== "once" && (
                <Field>
                  <FieldLabel htmlFor="schedule-end">
                    结束日期（可选）
                  </FieldLabel>
                  <Input
                    id="schedule-end"
                    type="date"
                    value={task.rule.endDate ?? ""}
                    onChange={(event) => {
                      const rule = { ...task.rule };
                      if (event.target.value) rule.endDate = event.target.value;
                      else delete rule.endDate;
                      patch({ rule });
                    }}
                  />
                </Field>
              )}
            </div>
          </section>
          <Collapsible
            open={advanced}
            onOpenChange={setAdvanced}
            className="border-t pt-4"
          >
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="-ml-3">
                <ChevronDown className={advanced ? "rotate-180" : ""} />
                高级设置
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-5 text-sm">
                {[
                  ["useKnowledge", "使用获授权知识"],
                  ["useMemory", "使用获授权记忆"],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2">
                    <Checkbox
                      checked={Boolean(task[field as "useMemory"])}
                      onCheckedChange={(value) =>
                        patch({ [field]: value === true })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={task.silentNoUpdate}
                  onCheckedChange={(value) =>
                    patch({ silentNoUpdate: value === true })
                  }
                />
                按任务规则无需新结果时保持安静
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="schedule-window">
                    允许延后启动（分钟）
                  </FieldLabel>
                  <Input
                    id="schedule-window"
                    type="number"
                    min={1}
                    max={1440}
                    value={task.startWindowMinutes}
                    onChange={(event) =>
                      patch({ startWindowMinutes: Number(event.target.value) })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="schedule-timeout">
                    执行等待上限（分钟）
                  </FieldLabel>
                  <Input
                    id="schedule-timeout"
                    type="number"
                    min={3}
                    max={60}
                    value={task.timeoutMinutes}
                    onChange={(event) =>
                      patch({ timeoutMinutes: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </fieldset>
        <aside className="space-y-5 border-t pt-5 xl:sticky xl:top-48 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
          <div className="flex items-center justify-between">
            <label htmlFor="schedule-enabled" className="text-sm font-medium">
              启用任务
            </label>
            <Switch
              id="schedule-enabled"
              checked={task.enabled}
              disabled={busy}
              onCheckedChange={(value) => patch({ enabled: value })}
            />
          </div>

          <div className="space-y-2 border-t pt-4">
            <h2 className="text-sm font-medium">
              {task.enabled ? "下次运行预览" : "启用后的时间预览"}
            </h2>
            <p className="text-xs leading-6 text-muted-foreground">
              {scheduleSummary(task.rule)}
              <br />
              {task.rule.timeZone}
            </p>
            {!preview ? (
              <p role="status" className="text-xs text-muted-foreground">
                正在核对时间…
              </p>
            ) : preview.error ? (
              <p role="alert" className="text-xs text-destructive">
                {preview.error}
              </p>
            ) : !preview.starts.length ? (
              <p className="text-xs text-destructive">
                没有未来执行时间，请调整日期或时间。
              </p>
            ) : (
              <ol className="space-y-2 pt-2 text-xs">
                {preview.starts.map((at, index) => (
                  <li
                    key={at}
                    className={index ? "text-muted-foreground" : "font-medium"}
                  >
                    {scheduleAt(at, task.rule.timeZone)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </form>
      <AlertDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的修改？</AlertDialogTitle>
            <AlertDialogDescription>
              本次填写的内容还没有保存。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (blocker.state === "blocked") blocker.proceed();
              }}
            >
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
