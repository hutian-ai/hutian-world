import "server-only";
import { cache } from "react";
import type { Workspace } from "@hutian-world/contracts";

export class ApiError extends Error {}
export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const endpoint = process.env.HUTIAN_API_URL ?? "http://127.0.0.1:3341";
  const token = process.env.HUTIAN_API_TOKEN;
  if (!token) throw new ApiError("应用配置尚未准备，请先运行本地配置命令。");
  let response: Response;
  try {
    response = await fetch(endpoint + path, {
      method, cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { "Authorization": `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new ApiError("暂时无法连接工作台，请稍后刷新并核对原记录。"); }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new ApiError(typeof error?.message === "string" ? error.message : "操作未完成，请刷新后核对当前记录。");
  }
  return response.json() as Promise<T>;
}
export const getWorkspace = cache(() => api<Workspace>("/v1/workspace"));
