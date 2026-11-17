import { z } from "zod";
import { type ResourceScope } from "./resource-scopes.js";
import {
  listKnowledge,
  listMemories,
  memoryOperation,
  readMemory,
  readKnowledge,
  resourcePluginStatus,
  remember,
  saveKnowledge,
  searchKnowledge,
  searchMemory,
} from "./resources.js";
function failure(e: unknown) {
  return {
    ok: false as const,
    error:
      e instanceof Error && !e.message.includes("ENOENT")
        ? e.message
        : "资源连接尚未配置，请检查本机私有连接文件。",
  };
}
export async function loadResources(
  kind: "memory" | "knowledge",
  scope?: ResourceScope,
) {
  try {
    return {
      ok: true as const,
      data:
        kind === "memory"
          ? await listMemories(scope)
          : { documents: await listKnowledge(scope) },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function saveResource(
  kind: "memory" | "knowledge",
  input: unknown,
  scope?: ResourceScope,
) {
  try {
    const value = z
      .object({
        id: z.uuid(),
        title: z.string().trim().min(1).max(80),
        content: z
          .string()
          .trim()
          .min(1)
          .max(kind === "memory" ? 20000 : 60000),
      })
      .strict()
      .parse(input);
    return {
      ok: true as const,
      data:
        kind === "memory"
          ? await remember(value, scope)
          : await saveKnowledge(value, scope),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function findResources(
  kind: "memory" | "knowledge",
  query: string,
  scope?: ResourceScope,
) {
  try {
    z.string().trim().min(1).max(2000).parse(query);
    return {
      ok: true as const,
      references:
        kind === "memory"
          ? await searchMemory(query, scope)
          : await searchKnowledge(query, scope),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function readMemorySource(id: string, scope?: ResourceScope) {
  try {
    return { ok: true as const, data: await readMemory(id, scope) };
  } catch (e) {
    return failure(e);
  }
}
export async function observeMemory(id: string, scope?: ResourceScope) {
  try {
    return { ok: true as const, data: await memoryOperation(id, scope) };
  } catch (e) {
    return failure(e);
  }
}

export async function readKnowledgeSource(id: string, scope?: ResourceScope) {
  try {
    return { ok: true as const, data: await readKnowledge(id, scope) };
  } catch (e) {
    return failure(e);
  }
}
export async function inspectResourcePlugins(scope?: ResourceScope) {
  return resourcePluginStatus(scope);
}
