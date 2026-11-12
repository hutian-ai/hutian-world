import { setupDotenv } from "c12";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export async function environment() {
  await setupDotenv({ cwd: fileURLToPath(new URL("../../..", import.meta.url)), fileName: ".local/app.env", interpolate: false });
  const result = z.object({
    HUTIAN_DATABASE_URL: z.url().refine(v => v.startsWith("postgresql://") || v.startsWith("postgres://")),
    HUTIAN_API_TOKEN: z.string().min(40),
    HUTIAN_CREATOR_ID: z.uuid(),
    HUTIAN_API_PORT: z.coerce.number().int().min(1024).max(65535).default(3341),
  }).safeParse(process.env);
  if (!result.success) throw new Error("缺少或无效的本地配置，请运行 pnpm setup:local 或填写 .local/app.env。");
  return result.data;
}
export type Environment = Awaited<ReturnType<typeof environment>>;
