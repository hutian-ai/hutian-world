import { setupDotenv } from "c12";
import { fileURLToPath } from "node:url";
await setupDotenv({ cwd: fileURLToPath(new URL("../..", import.meta.url)), fileName: ".local/app.env", interpolate: false });
/** @type {import("next").NextConfig} */
const config = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: ["@hutian-world/contracts"],
  serverExternalPackages: ["@harness-dock/client"],
};
export default config;
