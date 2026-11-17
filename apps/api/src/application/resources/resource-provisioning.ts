import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { ApplicationError } from "../../common/errors/application-error.js";
import { appDataDirectory } from "../../config/paths.js";
import { requireLocalConnection } from "../../modules/access/connection-access.js";
import {
  resourcePlugins,
  type ResourcePlugin,
} from "../../modules/resource-plugins/registry.js";
import type { ApplicationServices } from "../application-services.js";
const { memory: memoryPlugin, knowledge: knowledgePlugin } = resourcePlugins;
export async function privateResourceConfig(
  app: Pick<ApplicationServices, "contexts">,
  name: string,
): Promise<unknown> {
  await requireLocalConnection(app, "resources");
  return privateJson(resolve(appDataDirectory, name));
}
async function privateJson(path: string): Promise<unknown> {
  const info = await stat(path);
  if (!info.isFile() || info.size > 32768 || info.mode & 0o077)
    throw new ApplicationError("资源连接配置必须是私有文件。");
  return JSON.parse(await readFile(path, "utf8"));
}
async function scopedClient<Client, Config>(
  app: Pick<ApplicationServices, "contexts">,
  plugin: ResourcePlugin<Client, Config>,
  key: string,
  create: boolean,
): Promise<Config | null> {
  await requireLocalConnection(app, "resources");
  if (!/^hw-[a-f0-9]{40}$/.test(key))
    throw new ApplicationError("资源范围无效。");
  // Preserve existing memory credential paths; knowledge gets its own scoped client directory.
  const directory = resolve(
    appDataDirectory,
    plugin.kind === "memory" ? "resource-clients" : "knowledge-clients",
  );
  const path = resolve(directory, `${key}.json`);
  try {
    return plugin.parseConfig(await privateJson(path));
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ))
      throw error;
  }
  if (!create) return null;
  const provisioner = await privateResourceConfig(
    app,
    `${plugin.kind}-provisioner.json`,
  );
  const client = await plugin.provision(provisioner, key);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(client), {
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return client;
}
export const scopedMemoryClient = (
  app: Pick<ApplicationServices, "contexts">,
  key: string,
  create: boolean,
) => scopedClient(app, memoryPlugin, key, create);
export const scopedKnowledgeClient = (
  app: Pick<ApplicationServices, "contexts">,
  key: string,
  create: boolean,
) => scopedClient(app, knowledgePlugin, key, create);
