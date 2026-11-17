import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { parseArgs } from "node:util";
import {
  MemoryGatewayAdminClient,
  provisionerConfig as memoryConfig,
} from "../../memory-access/sdk/dist/index.js";
import {
  KnowledgeGatewayAdminClient,
  provisionerConfig as knowledgeConfig,
} from "../../knowledge-gateway/sdk/dist/index.js";

// Local operator setup. The gateway owns grants and backend namespace selection.
process.umask(0o077);
try {
  const { values } = parseArgs({
    options: { kind: { type: "string" }, config: { type: "string" } },
  });
  if (
    !["memory", "knowledge"].includes(values.kind) ||
    !values.config ||
    !isAbsolute(values.config)
  )
    throw new Error(
      "Provide a module kind and an absolute private configuration path.",
    );
  const info = await stat(values.config);
  if (!info.isFile() || info.size > 32768 || info.mode & 0o077)
    throw new Error("Provisioner configuration must be a private file.");
  const schema = values.kind === "memory" ? memoryConfig : knowledgeConfig;
  const config = schema.parse(
    JSON.parse(await readFile(values.config, "utf8")),
  );
  // Construction validates the transport address without provisioning a resource.
  const AdminClient =
    values.kind === "memory"
      ? MemoryGatewayAdminClient
      : KnowledgeGatewayAdminClient;
  new AdminClient(config);
  const directory = resolve(import.meta.dirname, "../.local");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    resolve(directory, `${values.kind}-provisioner.json`),
    JSON.stringify(config, null, 2),
    { mode: 0o600, flag: "wx" },
  );
  console.log("已配置模块管理连接；已有资源和凭据保持不变。");
} catch (error) {
  console.error(
    error?.code === "EEXIST"
      ? "已有配置，未覆盖。请核对对应的 .local/*-provisioner.json。"
      : "资源配置未写入。请按 README 指定 --kind 与 --config，确认配置文件私有且包含网关 URL 和管理凭据。",
  );
  process.exitCode = 1;
}
