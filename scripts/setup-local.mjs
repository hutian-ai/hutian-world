import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";

process.umask(0o077);
const root = new URL("../", import.meta.url);
const config = new URL(".local/app.env", root);
await mkdir(new URL(".local/", root), { recursive: true, mode: 0o700 });
await chmod(new URL(".local/", root), 0o700);
try {
  await readFile(config);
  console.log("已有 .local/app.env，保留原配置。结构更新请运行 pnpm db:migrate。");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  // This workspace shares a local Docker instance. Other deployments supply their own DATABASE_URL.
  let administrator;
  try { administrator = (await readFile(new URL("../../.local/postgres/admin-password", import.meta.url), "utf8")).trim(); }
  catch { throw new Error("未找到工作区数据库管理员配置。请按 README 的独立部署步骤填写 .local/app.env。"); }
  const db = new Client({ host: "127.0.0.1", port: 5432, database: "postgres", user: "hutian_admin", password: administrator });
  const password = randomBytes(32).toString("hex");
  try {
    await db.connect();
    const existing = await db.query("SELECT 1 FROM pg_database WHERE datname = 'hutian_world' UNION ALL SELECT 1 FROM pg_roles WHERE rolname = 'hutian_world_app'");
    if (existing.rowCount) throw new Error("同名数据库或账号已存在。请核对已有配置；未覆盖凭据。");
    // Fixed identifiers and a generated hexadecimal password, no user-provided SQL.
    await db.query(`CREATE ROLE hutian_world_app LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
    await db.query("CREATE DATABASE hutian_world OWNER hutian_world_app");
    await writeFile(config, [
      "# 本机私有配置；不提交到仓库。",
      `HUTIAN_DATABASE_URL=postgresql://hutian_world_app:${password}@127.0.0.1:5432/hutian_world`,
      `HUTIAN_API_TOKEN=${randomBytes(32).toString("hex")}`,
      `HUTIAN_CREATOR_ID=${randomUUID()}`,
      "HUTIAN_API_PORT=3341", "HUTIAN_API_URL=http://127.0.0.1:3341", "",
    ].join("\n"), { flag: "wx", mode: 0o600 });
    await chmod(config, 0o600);
    console.log("独立数据库与非管理员账号已准备。配置保存在 .local/app.env，未输出密码。");
  } catch (error) {
    console.error(error.message.startsWith("同名") ? error.message : "本地数据库准备失败，请核对共享实例与管理员配置；未输出连接凭据。");
    process.exitCode = 1;
  } finally { await db.end(); }
}
