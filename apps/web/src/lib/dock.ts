import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  connectDock, DockError, loadClientOptions,
  type Dock, type DeviceNodeSummary, type ServerClientOptions,
} from "@harness-dock/client";
import { z } from "zod";
import { runtimeModels } from "./runtime-models";
import { requireLocalConnection } from "./access-bindings";

const clientFile = resolve(process.cwd(), "../../.local/dock-client.json");
export const maxDockCredentialBytes = 16_384;
const clientCredential = z.strictObject({
  clientId: z.uuid(),
  token: z.string().min(32).max(4096),
  endpoint: z.url().max(2048),
});

export type DockDevice = Pick<DeviceNodeSummary, "nodeId" | "label" | "connected">;
export type DockDirectoryDevice = DockDevice & {
  hostname?: string;
  platform?: string;
  inventoryState: "online" | "offline" | "unknown";
  message?: string;
  runtimes: { key: string; displayName: string; status: string; version: string | null; modelCount: number }[];
};

type DockConnection =
  | { state: "missing" }
  | { state: "error"; message: string }
  | { state: "connected"; endpoint: string; devices: DockDirectoryDevice[] };

class ConnectionInputError extends Error {}

export function dockErrorMessage(error: unknown): string {
  if (error instanceof ConnectionInputError) return error.message;
  const kind = error instanceof DockError ? error.kind : error instanceof Error ? error.message : "";
  switch (kind) {
    case "invalid_client_file_permissions":
      return "Dock 应用凭据必须是私有文件，请重新导入或在本机将权限设为 600。";
    case "invalid_client_file":
    case "invalid_endpoint":
    case "Invalid URL":
      return "Dock 应用凭据或连接地址有误，请使用 Dock Server 导出的应用凭据。";
    case "server_handshake_rejected":
      return "Dock Server 拒绝了连接。请核对应用凭据和版本；如果同一凭据正在被另一进程使用，请等它结束后刷新。";
    case "server_tls_rejected":
      return "无法验证 Dock Server 的证书，请检查证书与信任配置。";
    case "server_connection_timeout":
    case "server_connection_refused":
    case "server_dns_failed":
    case "server_transport_failed":
      return "连接不上 Dock Server，请确认它已启动且地址可访问。";
    default:
      return "暂时无法确认 Dock 连接，请检查 Dock Server 后重试。";
  }
}

// Dock allows one active connection per application identity. Serialize short
// checks from this Web process and never leave the connection running after a check.
let previousCheck = Promise.resolve();
function checkInOrder<T>(check: () => Promise<T>): Promise<T> {
  const result = previousCheck.then(check);
  previousCheck = result.then(() => {}, () => {});
  return result;
}

async function withDock<T>(options: ServerClientOptions, read: (dock: Dock) => T | Promise<T>) {
  const dock = await connectDock({ ...options, connectTimeoutMs: 6_000 });
  try { return await read(dock); }
  finally { await dock.close(); }
}

async function publicConnection(options: ServerClientOptions, dock: Dock): Promise<DockConnection> {
  const endpoint = new URL(options.endpoint).host;
  const devices = await Promise.all(dock.listNodes().map(async ({ nodeId, label }): Promise<DockDirectoryDevice> => {
    const result = await readDockDevice(dock, nodeId);
    if (result.state === "online") return {
      ...result.device, ...result.platform, inventoryState: "online",
      runtimes: result.runtimes.map(({ models, sessionResume, ...runtime }) => ({ ...runtime, modelCount: models.length })),
    };
    return {
      nodeId, label, connected: result.state === "error" ? false : result.device.connected,
      inventoryState: result.state === "offline" ? "offline" : "unknown", runtimes: [],
      ...("message" in result ? { message: result.message } : {}),
    };
  }));
  return { state: "connected", endpoint, devices };
}

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function savedOptions() {
  await requireLocalConnection("dock");
  try { return await loadClientOptions(clientFile); }
  catch (error) {
    if (!isMissing(error)) throw error;
    if ((error as NodeJS.ErrnoException).path === clientFile) return null;
    throw new ConnectionInputError("Dock 凭据引用的证书文件不存在，请检查本机配置。");
  }
}

export function getDockConnection(): Promise<DockConnection> {
  return checkInOrder(async () => {
    try {
      const options = await savedOptions();
      if (!options) return { state: "missing" };
      return await withDock(options, (dock) => publicConnection(options, dock));
    } catch (error) {
      return { state: "error", message: dockErrorMessage(error) };
    }
  });
}

async function readDockDevice(dock: Dock, nodeId: string) {
  const peer = dock.client.node(nodeId);
  if (!peer) return { state: "error" as const, message: "这台设备未授权给当前 Dock 连接。" };
  const device: DockDevice = { nodeId, label: peer.label, connected: peer.connected };
  if (!peer.connected) return { state: "offline" as const, device };
  const daemonId = peer.daemonId;
  try {
    const inventory = await peer.request("inventory", {}, 12_000);
    if (!peer.connected || peer.daemonId !== daemonId || inventory.daemonId !== daemonId || inventory.nodeId !== nodeId) {
      return { state: "unknown" as const, device, message: "设备在读取期间断开或重连，请刷新后再试。" };
    }
    const runtimes = inventory.providers.map((provider) => ({
      key: provider.key,
      displayName: provider.displayName,
      status: provider.status,
      version: provider.version,
      models: runtimeModels(provider),
      sessionResume: provider.sessionResumeMode === "native",
    }));
    return { state: "online" as const, device, runtimes, platform: {
      hostname: inventory.platform.hostname, platform: inventory.platform.platform,
    } };
  } catch {
    return { state: "unknown" as const, device, message: "暂时读不到设备的 Runtime 列表，请稍后刷新。" };
  }
}

export function getDockDevice(nodeId: string) {
  return checkInOrder(async () => {
    try {
      const options = await savedOptions();
      if (!options) return { state: "error" as const, message: "请先连接 Dock Server。" };
      return await withDock(options, (dock) => readDockDevice(dock, nodeId));
    } catch (error) {
      return { state: "error" as const, message: dockErrorMessage(error) };
    }
  });
}

export async function saveDockCredential(json: string) {
  await requireLocalConnection("dock");
  let raw: unknown;
  try { raw = JSON.parse(json); }
  catch { throw new ConnectionInputError("文件不是有效的 JSON，请选择 Dock Server 导出的应用凭据。"); }
  const parsed = clientCredential.safeParse(raw);
  if (!parsed.success) throw new ConnectionInputError("请选择 Dock 应用的 client.json。设备配对文件和带私有证书路径的文件不能从网页导入。");

  return checkInOrder(async () => {
    await withDock(parsed.data, () => {});
    const directory = dirname(clientFile);
    const pending = resolve(directory, `dock-client-${randomUUID()}.tmp`);
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(pending, JSON.stringify(parsed.data) + "\n", { mode: 0o600, flag: "wx" });
      await rename(pending, clientFile);
    } catch {
      throw new ConnectionInputError("连接已验证，但没能保存凭据，请检查 Hutian 私有配置目录的权限。");
    } finally {
      await rm(pending, { force: true }).catch(() => {});
    }
  });
}
