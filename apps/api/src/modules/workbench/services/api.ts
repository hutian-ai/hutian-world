import type { Workspace } from "@hutian-world/contracts";
export class ApiError extends Error {}
type Invoke = (
  path: string,
  method: string,
  body?: unknown,
) => Promise<unknown>;
let invoke: Invoke;
export function bindApplicationServices(value: Invoke) {
  invoke = value;
}
/** In-process application calls retain the current AccessContexts scope. */
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!invoke) throw new ApiError("后端应用服务尚未就绪。");
  try {
    return (await invoke(path, method, body)) as T;
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "原操作尚未确认。",
    );
  }
}
export const getWorkspace = () => api<Workspace>("/v1/workspace");
