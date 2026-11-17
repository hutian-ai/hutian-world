import {
  accessContext,
  moduleKind,
  type ModuleKind,
} from "@hutian-world/contracts";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { ApplicationError } from "../../common/errors/application-error.js";
import { appDataDirectory } from "../../config/paths.js";
import type { AccessContexts } from "./access-context.service.js";
export const getAccess = async (app: { contexts: AccessContexts }) =>
  accessContext.parse(await app.contexts.current());
const binding = z
  .object({
    userId: z.uuid(),
    workspaceId: z.uuid(),
    resourceNamespace: z.string(),
    connections: accessContext.shape.connections,
    profile: z.literal("local-default"),
  })
  .strict();
const registry = z
  .object({ version: z.literal(1), bindings: z.array(binding).max(100) })
  .strict();
/** Local credentials have one explicit owner. A different request scope never falls back to these files. */
export async function requireLocalConnection(
  app: {
    contexts: AccessContexts;
  },
  kind: ModuleKind,
) {
  moduleKind.parse(kind);
  const current = await getAccess(app);
  const path = resolve(appDataDirectory, "access-bindings.json");
  let config: z.infer<typeof registry>;
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > 32768 || info.mode & 0o077)
      throw new Error();
    config = registry.parse(JSON.parse(await readFile(path, "utf8")));
  } catch {
    throw new ApplicationError(
      "模块连接尚未绑定当前空间，请运行 pnpm access:setup 核对本机连接归属。",
    );
  }
  const selected = config.bindings.find(
    (item) =>
      item.userId === current.userId &&
      item.workspaceId === current.workspaceId,
  );
  if (
    !selected ||
    selected.connections[kind] !== current.connections[kind] ||
    selected.resourceNamespace !== current.resourceNamespace
  )
    throw new ApplicationError(
      "当前空间或用户没有对应的模块连接，未使用其他人的默认连接。",
    );
  return current;
}
