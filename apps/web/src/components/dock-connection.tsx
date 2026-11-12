"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { CircleAlert, FileText, Laptop, RefreshCw, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FileUpload, FileUploadDropzone, FileUploadTrigger } from "@/components/ui/file-upload";
import { Spinner } from "@/components/ui/spinner";
import { connectDockFromFile } from "@/lib/dock-actions";

export function RefreshDockButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? <Spinner /> : <RefreshCw />}刷新状态
    </Button>
  );
}

export function DockConnectionDialog({ replacing, endpoint }: { replacing: boolean; endpoint?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const [file] = files;
    if (busy || !file) return;
    const form = new FormData();
    form.set("credential", file);
    setError(undefined);
    setBusy(true);
    try {
      const result = await connectDockFromFile(form);
      if (!result.ok) return setError(result.error);
      setOpen(false);
      router.refresh();
    } catch {
      setError("连接结果尚未确认。请刷新运行环境页面后再试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (busy) return;
      setError(undefined);
      setFiles([]);
      setOpen(value);
    }}>
      <DialogTrigger asChild>
        <Button type="button" variant={replacing ? "outline" : "default"}><Laptop />{replacing ? "连接设置" : "连接 Dock Server"}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] min-w-0 overflow-hidden p-0 sm:max-w-2xl">
        <form onSubmit={connect} className="grid max-h-[calc(100svh-2rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
          <DialogHeader className="min-w-0 px-6 pt-6 pr-12 text-left">
            <DialogTitle>连接 Dock Server</DialogTitle>
            <DialogDescription>导入应用凭据，读取此服务授权给 Hutian 的机器。</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto px-6 pb-2">
            {endpoint && <p className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground">
              当前 Dock Server <span className="ml-1 break-all text-foreground">{endpoint}</span>
            </p>}
            <FieldGroup className="gap-4">
              <div className="flex flex-col gap-2">
                <strong className="text-sm">准备应用凭据</strong>
                <p className="text-xs text-muted-foreground">在 Dock Server 为 Hutian 创建应用，授权要使用的机器，并导出 client.json。</p>
              </div>
              <Field data-disabled={busy}>
                <FieldLabel>应用凭据文件</FieldLabel>
                <FileUpload
                  value={files}
                  onValueChange={(next) => { setFiles(next); setError(undefined); }}
                  onFileReject={() => setError("请选择一个不超过 16 KB 的 JSON 文件。")}
                  disabled={busy}
                  accept=".json,application/json"
                  maxFiles={1}
                  maxSize={16 * 1024}
                  label="选择 Dock 应用凭据"
                >
                  {files.length ? (
                    <div className="flex min-w-0 items-center gap-3 rounded-md border bg-card px-3 py-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{files[0].name}</span>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="移除文件" disabled={busy}
                        onClick={() => { setFiles([]); setError(undefined); }}><X /></Button>
                    </div>
                  ) : (
                    <FileUploadDropzone className="gap-2 py-5">
                      <FileUploadTrigger asChild>
                        <Button type="button" variant="outline" size="sm"><Upload />选择 JSON 文件</Button>
                      </FileUploadTrigger>
                      <p className="text-xs text-muted-foreground">也可以将文件拖到这里</p>
                    </FileUploadDropzone>
                  )}
                </FileUpload>
                <FieldDescription>使用 Dock Server 导出的 client.json。验证通过后保存在 Hutian 服务端。更换服务会替换当前目录来源。</FieldDescription>
              </Field>
            </FieldGroup>
            {error && <Alert variant="destructive" role="alert">
              <CircleAlert /><AlertTitle>连接未确认</AlertTitle><AlertDescription>{error}</AlertDescription>
            </Alert>}
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit" disabled={busy || !files.length}>{busy && <Spinner />}{busy ? "验证连接…" : "验证并保存"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
