import { readFile, stat, writeFile } from "node:fs/promises";
import { accessContext } from "../packages/contracts/dist/index.js";
import { isDeepStrictEqual } from "node:util";

const root = new URL("../", import.meta.url);
const config = await readFile(new URL(".local/app.env", root), "utf8");
const token = config
  .match(/^HUTIAN_API_TOKEN=(.*)$/m)?.[1]
  ?.trim()
  .replace(/^['"]|['"]$/g, "");
const endpoint =
  config.match(/^HUTIAN_API_URL=(.*)$/m)?.[1]?.trim() ||
  "http://127.0.0.1:3341";
const origin = new URL(endpoint);
if (!token || origin.protocol !== "http:" || origin.hostname !== "127.0.0.1")
  throw new Error("请先核对本机应用配置。");
const response = await fetch(origin.origin + "/v1/access", {
  headers: { authorization: `Bearer ${token}` },
});
if (!response.ok)
  throw new Error("API 尚未准备身份与空间，请先迁移数据库并启动 API。");
const context = accessContext.parse(await response.json());
const binding = {
  userId: context.userId,
  workspaceId: context.workspaceId,
  resourceNamespace: context.resourceNamespace,
  connections: context.connections,
  profile: "local-default",
};
const path = new URL(".local/access-bindings.json", root);
try {
  const info = await stat(path);
  if (info.mode & 0o077) throw new Error("连接归属配置必须是私有文件。");
  const existing = JSON.parse(await readFile(path, "utf8"));
  if (
    existing.version !== 1 ||
    !existing.bindings?.some((item) => isDeepStrictEqual(item, binding))
  )
    throw new Error("已有连接属于不同身份或空间，未自动覆盖。");
  console.log("本机模块连接归属已匹配，保留原配置与凭据。");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await writeFile(
    path,
    JSON.stringify({ version: 1, bindings: [binding] }, null, 2),
    { mode: 0o600, flag: "wx" },
  );
  console.log("原本机模块连接已绑定到当前身份与空间，未复制或重建上游资产。");
}
