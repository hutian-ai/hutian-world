"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ScheduledRun } from "@hutian-world/contracts";
import { readScheduledResult } from "@/lib/schedule-actions";
import { scheduleAt, scheduleStateLabels } from "@/lib/schedule-display";
import { OrganizationMarkdown } from "./organization-markdown";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

export function ScheduleRuns({ runs, select, compact = false }: { runs: ScheduledRun[]; select: (run: ScheduledRun, element: HTMLElement) => void; compact?: boolean }) {
  return <div className="overflow-x-auto rounded-md border"><Table>
    <TableHeader><TableRow>{!compact && <TableHead>任务</TableHead>}<TableHead>计划时间</TableHead><TableHead>状态</TableHead><TableHead className="text-right">结果</TableHead></TableRow></TableHeader>
    <TableBody>{runs.map(run => <TableRow key={run.id}>
      {!compact && <TableCell className="max-w-72"><button className="text-left font-medium hover:underline" onClick={event => select(run, event.currentTarget)}>{run.snapshot.title}</button></TableCell>}
      <TableCell className="text-xs">{scheduleAt(run.scheduledAt, run.snapshot.rule.timeZone)}<p className="mt-1 text-muted-foreground">{run.manual ? "手动运行" : "定时触发"}</p></TableCell>
      <TableCell><Badge variant="outline">{scheduleStateLabels[run.state]}</Badge>{run.error && <p className="mt-1 max-w-md text-xs text-muted-foreground">{run.error}</p>}</TableCell>
      <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={event => select(run, event.currentTarget)}>{run.replyEventId ? "查看结果" : "查看记录"}</Button></TableCell>
    </TableRow>)}{!runs.length && <TableRow><TableCell colSpan={compact ? 3 : 4} className="py-12 text-center text-muted-foreground">还没有运行记录。任务会在计划时间触发，也可选择立即运行。</TableCell></TableRow>}</TableBody>
  </Table></div>;
}

export function ScheduleRunResult({ run, onClose, returnFocus }: { run: ScheduledRun | null; onClose: () => void; returnFocus?: React.RefObject<HTMLElement | null> }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof readScheduledResult>> | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setResult(null);
    if (!run?.replyEventId) return;
    let current = true;
    void readScheduledResult(run.id).then(value => { if (current) setResult(value); });
    return () => { current = false; };
  }, [run?.id, run?.replyEventId, retry]);
  return <Sheet open={Boolean(run)} onOpenChange={open => { if (!open) onClose(); }}><SheetContent className="w-full gap-0 sm:max-w-3xl" onCloseAutoFocus={event => { if (returnFocus?.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}>
    <SheetHeader className="shrink-0 border-b p-6 pr-12"><SheetTitle>{run?.snapshot.title ?? "运行记录"}</SheetTitle><SheetDescription>{run ? `${scheduleAt(run.scheduledAt, run.snapshot.rule.timeZone)} · ${scheduleStateLabels[run.state]}` : ""}</SheetDescription></SheetHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-6" tabIndex={0} aria-label="运行结果正文">
      {run?.error && <Alert variant="destructive" className="mb-4"><AlertDescription>{run.error}</AlertDescription></Alert>}
      {!run?.replyEventId ? <p className="text-sm text-muted-foreground">{run?.state === "skipped" ? "本次无需新结果。" : "尚未交付回复。"}</p> : !result ? <p role="status" className="text-sm text-muted-foreground">正在读取原消息…</p> : !result.ok ? <Alert variant="destructive"><AlertDescription>{result.error}<Button variant="outline" size="sm" className="ml-3" onClick={() => setRetry(value => value + 1)}>重试</Button></AlertDescription></Alert> : <div className="space-y-4">
        {Boolean(result.attachments.length) && <div className="flex flex-wrap gap-2">{result.attachments.map(file => <Button asChild key={file.name} variant="outline" size="sm"><a href={file.href} target="_blank" rel="noreferrer">打开附件 · {file.name}</a></Button>)}</div>}
        <OrganizationMarkdown content={result.attachments.reduce((text, file) => text.replaceAll(`](${file.sourcePath})`, `](${file.href})`), result.message.text)} />
      </div>}
    </div>
    {run?.eventId && <div className="shrink-0 border-t p-4"><Button asChild variant="outline" size="sm"><Link href={`/chat?${new URLSearchParams({ room: run.snapshot.roomId })}`}>打开交付会话</Link></Button></div>}
  </SheetContent></Sheet>;
}
