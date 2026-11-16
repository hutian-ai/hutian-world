import { appDataDirectory } from "../../../config/paths.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { requireLocalConnection } from "./access-bindings.js";

const run = promisify(execFile);
const local = appDataDirectory;
const clientSchema = z.object({
  url: z.url(),
  token: z.string(),
  grants: z.record(z.string(), z.array(z.string())),
  protocol: z.enum(["v1", "v2"]).default("v2"),
  writeMode: z.enum(["infer", "verbatim"]).default("infer"),
});
const provisionerSchema = z
  .object({
    python: z.string(),
    admin: z.string(),
    policy: z.string(),
    url: z.url(),
    connection: z.string().default("hindsight"),
    writeMode: z.enum(["infer", "verbatim"]).default("infer"),
  })
  .strict();
async function privateJson(path: string) {
  const info = await stat(path);
  if (!info.isFile() || info.size > 32768 || info.mode & 0o077)
    throw new Error("资源连接配置必须是私有文件。");
  return JSON.parse(await readFile(path, "utf8"));
}
export async function scopedMemoryClient(key: string, create: boolean) {
  await requireLocalConnection("resources");
  if (!/^hw-[a-f0-9]{40}$/.test(key)) throw new Error("记忆范围无效。");
  const directory = resolve(local, "resource-clients");
  const path = resolve(directory, `${key}.json`);
  try {
    return clientSchema.parse(await privateJson(path));
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
  let provisioner;
  try {
    provisioner = provisionerSchema.parse(
      await privateJson(resolve(local, "memory-provisioner.json")),
    );
  } catch {
    throw new Error(
      "尚未配置独立记忆空间的准备方式，请按 README 配置本机记忆接入管理命令。",
    );
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    // Trusted operator configuration only; no command, path, bank or credential comes from the browser.
    await run(
      provisioner.python,
      [
        provisioner.admin,
        "--policy",
        provisioner.policy,
        "resource",
        key,
        "--namespace",
        key,
        "--connection",
        provisioner.connection,
      ],
      { timeout: 10000 },
    );
    await run(
      provisioner.python,
      [
        provisioner.admin,
        "--policy",
        provisioner.policy,
        "issue",
        "--name",
        key,
        "--read",
        key,
        "--write",
        key,
        "--url",
        provisioner.url,
        "--output",
        path,
      ],
      { timeout: 10000 },
    );
    const client = clientSchema.parse(await privateJson(path));
    if (provisioner.writeMode !== client.writeMode) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        path,
        JSON.stringify({
          ...client,
          protocol: "v2",
          writeMode: provisioner.writeMode,
        }),
        { mode: 0o600 },
      );
    }
  } catch {
    // The admin CLI serializes policy changes. Another request may have prepared the same scope.
    try {
      return clientSchema.parse(await privateJson(path));
    } catch {
      throw new Error(
        "记忆空间准备未确认，未写入其他范围。请核对本机记忆连接后重试。",
      );
    }
  }
  return clientSchema.parse(await privateJson(path));
}
