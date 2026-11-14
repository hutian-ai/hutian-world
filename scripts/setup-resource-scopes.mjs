import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { parseArgs } from "node:util";

// Local operator setup only. This configuration is never accepted from a Web request.
const { values } = parseArgs({ options: {
  python: { type: "string", default: "/usr/bin/python3" },
  admin: { type: "string" }, policy: { type: "string" },
  url: { type: "string", default: "http://127.0.0.1:3332" },
} });
process.umask(0o077);
try {
  const root = resolve(import.meta.dirname, "..");
  if (!values.admin || !values.policy || ![values.python, values.admin, values.policy].every(isAbsolute))
    throw new Error("请提供 Python、memory-access 的 admin.py 和 policy.json 的绝对路径。");
  const origin = new URL(values.url);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1") throw new Error("当前版本使用本机记忆接入地址。");
  for (const file of [values.python, values.admin, values.policy]) if (!(await stat(file)).isFile()) throw new Error("所选文件不存在。");
  await mkdir(resolve(root, ".local"), { recursive: true, mode: 0o700 });
  await writeFile(resolve(root, ".local/memory-provisioner.json"), JSON.stringify(values, null, 2), { mode: 0o600, flag: "wx" });
  console.log("独立记忆空间的本机准备命令已配置；已有凭据和资源保持不变。");
} catch (error) {
  console.error(error?.code === "EEXIST" ? "已有配置，未覆盖。请核对 .local/memory-provisioner.json。" : "资源配置未写入。请核对所选路径和 README 中的配置说明。");
  process.exitCode = 1;
}
