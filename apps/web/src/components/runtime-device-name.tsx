"use client";
import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@hutian-ai/design/ui/button";
import { Input } from "@hutian-ai/design/ui/input";
import { Label } from "@hutian-ai/design/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@hutian-ai/design/ui/dialog";
import { saveRuntimeDeviceName, type DockDevice } from "@/lib/dock";
import { useRouter } from "@/lib/navigation";

export function RuntimeDeviceName({ device }: { device: DockDevice }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(device.customName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!device.nameSettings) return null;
  async function save(customName: string | null) {
    if (busy || !device.nameSettings) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await saveRuntimeDeviceName({
        nodeId: device.nodeId,
        connectionId: device.nameSettings.connectionId,
        sourceKey: device.nameSettings.sourceKey,
        expectedVersion: device.nameSettings.version,
        customName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("保存结果尚未确认，请刷新核对最新名称。");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void save(name.trim() || null);
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (busy) return;
        setOpen(value);
        setName(device.customName ?? "");
        setError(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil />
          修改名称
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>修改设备名称</DialogTitle>
            <DialogDescription>
              名称会同步显示在运行环境、成员配置与聊天中。留空则显示设备编号。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="runtime-device-name">设备名称</Label>
            <Input
              id="runtime-device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={busy}
              placeholder="留空使用设备编号"
              autoComplete="off"
            />
            <p className="break-all text-xs text-muted-foreground">
              设备编号：{device.nodeId}
            </p>
          </div>
          {error && (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  router.refresh();
                }}
              >
                读取最新名称
              </Button>
            </div>
          )}
          <DialogFooter className="gap-2">
            {device.customName && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void save(null)}
              >
                恢复编号
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "保存中…" : "保存名称"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
