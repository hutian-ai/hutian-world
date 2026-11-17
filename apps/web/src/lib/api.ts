import type { WorkbenchCommands, Workspace } from "@hutian-world/contracts";
import { operationMetadata } from "@hutian-world/contracts";
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code = 50000,
    readonly status = 0,
    readonly requestId = "",
    readonly recovery = "observe",
  ) {
    super(message);
  }
}
let establishing: Promise<void> | undefined;
async function establish() {
  establishing ??= fetch("/api/session", {
    credentials: "same-origin",
    headers: { "x-hutian-client": "web" },
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new ApiError("工作台会话尚未建立，请刷新重试。");
    })
    .catch((error) => {
      establishing = undefined;
      throw error;
    });
  return establishing;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  if (!/^\/v[12]\//.test(path)) throw new ApiError("应用接口地址无效。");
  await establish();
  const request = () =>
    fetch("/api" + path.replace(/^\/v1\//, "/v2/"), {
      method,
      signal: AbortSignal.any([
        AbortSignal.timeout(60000),
        ...(options.signal ? [options.signal] : []),
      ]),
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
  let response = await request();
  if (response.status === 401) {
    establishing = undefined;
    await establish();
    response = await request();
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.code !== 0) {
    throw new ApiError(
      typeof result?.msg === "string"
        ? result.msg
        : "操作结果尚未确认，请核对原记录。",
      result?.code ?? 50200,
      response.status,
      result?.requestId ?? response.headers.get("x-request-id") ?? "",
      result?.recovery ?? "observe",
    );
  }
  return result.data as T;
}
async function encode(value: unknown): Promise<unknown> {
  if (value instanceof FormData) {
    const entries = await Promise.all(
      [...value.entries()].map(async ([key, entry]) => {
        if (typeof entry === "string") return [key, entry];
        if (entry.size > 16384) throw new ApiError("凭据文件需小于 16 KB。");
        const bytes = new Uint8Array(await entry.arrayBuffer());
        return [
          key,
          {
            name: entry.name,
            mime: entry.type,
            base64: btoa(String.fromCharCode(...bytes)),
          },
        ];
      }),
    );
    return { type: "form-data", entries };
  }
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  if (value && typeof value === "object")
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([key, entry]) => [
          key,
          await encode(entry),
        ]),
      ),
    );
  return value;
}
export function command<K extends keyof WorkbenchCommands>(
  name: K,
): WorkbenchCommands[K] {
  return ((...args: unknown[]) =>
    encode(args)
      .then((body) =>
        api(`/v1/commands/${encodeURIComponent(name)}`, "POST", body),
      )
      .then((result) => {
        const state = result as { success?: boolean; ok?: boolean } | null;
        const changesPage = operationMetadata[name].refresh;
        if (changesPage && (state?.success === true || state?.ok === true))
          window.dispatchEvent(new Event("hutian:refresh"));
        return result;
      })
      .catch((error: unknown) => {
        const action = operationMetadata[name].formResult;
        if (!action) throw error;
        const failure =
          error instanceof ApiError
            ? error
            : new ApiError("操作结果尚未确认，请核对原记录。");
        return {
          ok: false,
          error: failure.message,
          code: failure.code,
          requestId: failure.requestId,
          recovery: failure.recovery,
          submission: "unknown",
        };
      })) as WorkbenchCommands[K];
}
export const getWorkspace = () => api<Workspace>("/v1/workspace");
