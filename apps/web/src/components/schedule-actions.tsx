"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pause, Pencil, Play, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import type { ScheduledTask, ScheduledRun } from "@hutian-world/contracts";
import { deleteSchedule, runSchedule, toggleSchedule } from "@/lib/schedule-actions";
import { scheduleHref } from "@/lib/schedule-display";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "./ui/alert-dialog";
import { Alert, AlertDescription } from "./ui/alert";

export function ScheduleActions({ task, returnTo, onChanged, onPreview, compact = false }: {
  task: ScheduledTask; returnTo: string; onChanged: () => void | Promise<void>; onPreview?: (element: HTMLElement) => void; compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [deleting, setDeleting] = useState(false), [error, setError] = useState("");
  const locked = useRef(false), requestId = useRef<string | null>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  async function command(action: "toggle" | "run" | "delete") {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try {
      requestId.current ??= crypto.randomUUID();
      const result: { ok: true; run?: ScheduledRun } | { ok: false; error: string } = action === "run" ? await runSchedule(task.id, requestId.current) : action === "delete" ? await deleteSchedule(task.id, task.revision) : await toggleSchedule(task.id, !task.enabled, task.revision);
      if (!result.ok) { setError(result.error); toast.error(result.error); return; }
      if (action === "delete") setDeleting(false);
      toast.success(action === "run" ? "已加入运行队列" : action === "delete" ? "任务已删除，运行记录已保留" : task.enabled ? "已暂停后续触发" : "已启用定时任务");
      await onChanged();
      if (action === "run" && result.run) {
        requestId.current = null;
        const params = new URLSearchParams(returnTo.split("?")[1] ?? ""); params.set("tab", "runs"); params.set("run", result.run.id); params.delete("selected");
        router.push(`/schedules?${params}`);
      }
    } catch { setError("操作结果未确认，请核对原记录后重试同一请求。"); }
    finally { locked.current = false; setBusy(false); }
  }
  if (task.status === "deleted") return null;
  return <>
    <div className="flex shrink-0 items-center gap-2">
      {!compact && <><Button variant="outline" size="sm" disabled={busy} onClick={() => void command("run")}><Play />立即运行</Button><Button asChild size="sm"><Link href={scheduleHref(task.id, returnTo, true)}><Pencil />编辑任务</Link></Button></>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button ref={menuTrigger} variant="ghost" size="icon-sm" disabled={busy} aria-label={`${task.title}的操作`}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onPreview && <DropdownMenuItem onSelect={() => { if (menuTrigger.current) onPreview(menuTrigger.current); }}><Eye />查看详情</DropdownMenuItem>}
          <DropdownMenuItem asChild><Link href={scheduleHref(task.id, returnTo, true)}><Pencil />编辑任务</Link></DropdownMenuItem>
          <DropdownMenuItem disabled={task.status === "ended"} onSelect={() => void command("toggle")}>{task.enabled ? <Pause /> : <Play />}{task.enabled ? "暂停任务" : "启用任务"}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void command("run")}><Play />立即运行</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => { setError(""); setDeleting(true); }}><Trash2 />删除任务</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <AlertDialog open={deleting} onOpenChange={open => { if (!busy) setDeleting(open); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除「{task.title}」？</AlertDialogTitle><AlertDialogDescription>删除后不再定时触发。已生成或执行中的运行会继续处理，历史记录和原会话中的结果仍然保留。</AlertDialogDescription></AlertDialogHeader>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={event => { event.preventDefault(); void command("delete"); }}>{busy ? "删除中…" : "删除任务"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
