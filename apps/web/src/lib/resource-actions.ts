"use server";
import { z } from "zod";
import {
  listKnowledge,
  listMemories,
  memoryOperation,
  readMemory,
  remember,
  saveKnowledge,
  searchKnowledge,
  searchMemory,
} from "./resources";
function failure(e: unknown) {
  return {
    ok: false as const,
    error:
      e instanceof Error && !e.message.includes("ENOENT")
        ? e.message
        : "资源连接尚未配置，请检查本机私有连接文件。",
  };
}
export async function loadResources(kind: "memory" | "knowledge") {
  try {
    return {
      ok: true as const,
      data:
        kind === "memory"
          ? await listMemories()
          : { documents: await listKnowledge() },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function saveResource(
  kind: "memory" | "knowledge",
  input: unknown,
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
        kind === "memory" ? await remember(value) : await saveKnowledge(value),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function findResources(
  kind: "memory" | "knowledge",
  query: string,
) {
  try {
    z.string().trim().min(1).max(2000).parse(query);
    return {
      ok: true as const,
      references:
        kind === "memory"
          ? await searchMemory(query)
          : await searchKnowledge(query),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function readMemorySource(id: string) {
  try {
    return { ok: true as const, data: await readMemory(id) };
  } catch (e) {
    return failure(e);
  }
}
export async function observeMemory(id: string) {
  try {
    return { ok: true as const, data: await memoryOperation(id) };
  } catch (e) {
    return failure(e);
  }
}
