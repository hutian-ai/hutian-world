import { z } from "zod";
import { actionFailure } from "../../common/errors/application-error.js";
import { pageArray } from "../../common/pagination.js";
import type { ApplicationServices } from "../application-services.js";
import { type ResourceScope } from "./resource-scopes.js";
import {
  listKnowledge,
  listMemories,
  memoryOperation,
  readKnowledge,
  readMemory,
  remember,
  resourcePluginStatus,
  saveKnowledge,
  searchKnowledge,
  searchMemory,
} from "./resources.js";
function failure(e: unknown) {
  return actionFailure(e);
}
export async function loadResources(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  kind: "memory" | "knowledge",
  scope?: ResourceScope,
  cursor?: string,
) {
  try {
    const page =
      kind === "knowledge"
        ? pageArray(
            await listKnowledge(app, scope),
            (item) => ({ at: item.createdAt, id: item.id }),
            cursor,
          )
        : null;
    return {
      ok: true as const,
      data:
        kind === "memory"
          ? await listMemories(app, scope, cursor)
          : { documents: page!.items, nextCursor: page!.nextCursor },
    };
  } catch (e) {
    return failure(e);
  }
}
export async function saveResource(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
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
          ? await remember(app, value, scope)
          : await saveKnowledge(app, value, scope),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function findResources(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
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
          ? await searchMemory(app, query, scope)
          : await searchKnowledge(app, query, scope),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function readMemorySource(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  id: string,
  scope?: ResourceScope,
) {
  try {
    return { ok: true as const, data: await readMemory(app, id, scope) };
  } catch (e) {
    return failure(e);
  }
}
export async function observeMemory(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  id: string,
  scope?: ResourceScope,
) {
  try {
    return { ok: true as const, data: await memoryOperation(app, id, scope) };
  } catch (e) {
    return failure(e);
  }
}
export async function readKnowledgeSource(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  id: string,
  scope?: ResourceScope,
) {
  try {
    return { ok: true as const, data: await readKnowledge(app, id, scope) };
  } catch (e) {
    return failure(e);
  }
}
export async function inspectResourcePlugins(
  app: Pick<ApplicationServices, "contexts" | "workspace">,
  scope?: ResourceScope,
) {
  return resourcePluginStatus(app, scope);
}
