import type { WorkbenchCommands, Workspace } from "@hutian-world/contracts";
export class ApiError extends Error {}
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
): Promise<T> {
  if (!path.startsWith("/v1/")) throw new ApiError("应用接口地址无效。");
  await establish();
  const request = () =>
    fetch("/api" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let response = await request();
  if (response.status === 401) {
    establishing = undefined;
    await establish();
    response = await request();
  }
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    throw new ApiError(
      typeof failure?.message === "string"
        ? failure.message
        : "原操作尚未确认，请刷新核对。",
    );
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
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
        const changesPage =
          name.startsWith("actions.") ||
          name.startsWith("role-runtime-actions.") ||
          [
            "schedule-actions.saveSchedule",
            "schedule-actions.deleteSchedule",
            "schedule-actions.toggleSchedule",
            "schedule-actions.runSchedule",
          ].includes(name);
        if (changesPage && (state?.success === true || state?.ok === true))
          window.dispatchEvent(new Event("hutian:refresh"));
        return result;
      })) as WorkbenchCommands[K];
}
export const getWorkspace = () => api<Workspace>("/v1/workspace");
