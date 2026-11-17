import { appDataDirectory } from "../../../config/paths.js";
import {
  mkdir,
  readFile,
  stat,
  writeFile,
  rename,
  unlink,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { requireLocalConnection } from "./access-bindings.js";
import {
  resourcePlugins,
  type ResourcePlugin,
} from "../../resource-plugins/registry.js";

const { memory: memoryPlugin, knowledge: knowledgePlugin } = resourcePlugins;

export async function privateResourceConfig(name: string): Promise<unknown> {
  await requireLocalConnection("resources");
  return privateJson(resolve(appDataDirectory, name));
}
async function privateJson(path: string): Promise<unknown> {
  const info = await stat(path);
  if (!info.isFile() || info.size > 32768 || info.mode & 0o077)
    throw new Error("资源连接配置必须是私有文件。");
  return JSON.parse(await readFile(path, "utf8"));
}
async function scopedClient<Client, Config>(
  plugin: ResourcePlugin<Client, Config>,
  key: string,
  create: boolean,
): Promise<Config | null> {
  await requireLocalConnection("resources");
  if (!/^hw-[a-f0-9]{40}$/.test(key)) throw new Error("资源范围无效。");
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
export const scopedMemoryClient = (key: string, create: boolean) =>
  scopedClient(memoryPlugin, key, create);
export const scopedKnowledgeClient = (key: string, create: boolean) =>
  scopedClient(knowledgePlugin, key, create);
