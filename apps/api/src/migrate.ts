import { environment } from "./environment.js";
import { dataSource } from "./database/source.js";
try {
  const env = await environment();
  const db = dataSource(env.HUTIAN_DATABASE_URL);
  try {
    await db.initialize();
    const applied = await db.runMigrations();
    console.log(applied.length ? `数据库迁移完成：${applied.length} 项。` : "数据库结构已是当前版本。");
  } finally { if (db.isInitialized) await db.destroy(); }
} catch { console.error("数据库迁移失败，请检查本地配置、数据库连接和现有迁移记录；未输出连接凭据。"); process.exitCode = 1; }
