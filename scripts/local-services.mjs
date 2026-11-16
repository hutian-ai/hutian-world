import { chmod, mkdir, open, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

// Workspace integration: launchd owns these processes, independently of a shell
// or Codex chat. Private application configuration remains in its original files.
const run = promisify(execFile);
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(project, "..");
const logs = resolve(project, ".local/services");
const agents = resolve(homedir(), "Library/LaunchAgents");
const domain = process.getuid ? `gui/${process.getuid()}` : "";
const services = [
  {
    name: "chat-host",
    cwd: resolve(workspace, "matrix-team-chat"),
    args: ["--import", "tsx", "examples/web/server.ts"],
    url: "http://127.0.0.1:3310/api/health",
    required: "examples/web/server.ts",
  },
  {
    name: "api",
    cwd: resolve(project, "apps/api"),
    args: ["dist/main.js"],
    url: "http://127.0.0.1:3341/health",
    required: "dist/main.js",
  },
  {
    name: "web",
    cwd: resolve(project, "apps/web"),
    args: ["scripts/serve.mjs"],
    url: "http://127.0.0.1:3340/chat",
    required: "dist/index.html",
  },
].map((s) => ({
  ...s,
  label: `org.hutian.world.${s.name}`,
  plist: resolve(agents, `org.hutian.world.${s.name}.plist`),
}));
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const string = (s) => `<string>${escape(s)}</string>`;
async function inspect(s) {
  try {
    const { stdout } = await run("/bin/launchctl", [
      "print",
      `${domain}/${s.label}`,
    ]);
    return {
      loaded: true,
      pid: Number(stdout.match(/\bpid = (\d+)/)?.[1]) || null,
      state: stdout.match(/\bstate = ([^\n]+)/)?.[1]?.trim() ?? "unknown",
    };
  } catch {
    return { loaded: false, pid: null, state: "stopped" };
  }
}
async function health(s) {
  try {
    return (
      (
        await fetch(s.url, {
          signal: AbortSignal.timeout(3000),
          redirect: "error",
        })
      ).status === 200
    );
  } catch {
    return false;
  }
}
async function status() {
  const rows = await Promise.all(
    services.map(async (s) => ({
      service: s.name,
      ...(await inspect(s)),
      healthy: await health(s),
    })),
  );
  console.table(rows);
  return rows;
}
async function main() {
  if (process.platform !== "darwin")
    throw new Error(
      "此常驻入口使用 macOS launchd；其他平台请使用 README 的独立启动方式。",
    );
  const action = process.argv[2] ?? "status";
  if (!["start", "stop", "status"].includes(action))
    throw new Error(
      "用法：node scripts/local-services.mjs start | stop | status",
    );
  if (action === "status") {
    if ((await status()).some((s) => !s.healthy)) process.exitCode = 1;
    return;
  }
  if (action === "stop") {
    for (const s of [...services].reverse()) {
      if ((await inspect(s)).loaded)
        await run("/bin/launchctl", ["bootout", `${domain}/${s.label}`]);
      // bootout can return while launchd still reports a SIGTERMed service. A
      // following start must not mistake that dying process for a running one.
      for (
        let attempt = 0;
        attempt < 50 && (await inspect(s)).loaded;
        attempt++
      )
        await delay(200);
      if ((await inspect(s)).loaded)
        throw new Error(`${s.name} 尚未退出，请核对服务状态后重试启动。`);
      // An explicit stop also disables login startup. Data and logs are retained.
      const { unlink } = await import("node:fs/promises");
      await unlink(s.plist).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    }
    await status();
    return;
  }
  for (const s of services)
    if (!(await stat(resolve(s.cwd, s.required))).isFile())
      throw new Error(`缺少 ${s.name} 的运行产物，请先完成安装和构建。`);
  await mkdir(agents, { recursive: true });
  await mkdir(logs, { recursive: true, mode: 0o700 });
  for (const s of services)
    for (const suffix of ["log", "error.log"]) {
      const file = resolve(logs, `${s.name}.${suffix}`);
      await (await open(file, "a", 0o600)).close();
      await chmod(file, 0o600);
    }
  const path = [
    dirname(process.execPath),
    resolve(homedir(), ".local/bin"),
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ].join(":");
  for (const s of services) {
    const loaded = await inspect(s);
    if (loaded.loaded) continue;
    if (await health(s))
      throw new Error(
        `${s.name} 已由其他进程占用，请先核对并停止该临时进程；未接管或终止它。`,
      );
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key>${string(s.label)}
<key>ProgramArguments</key><array>${[process.execPath, ...s.args].map(string).join("")}</array>
<key>WorkingDirectory</key>${string(s.cwd)}
<key>EnvironmentVariables</key><dict><key>PATH</key>${string(path)}</dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>5</integer>
<key>StandardOutPath</key>${string(resolve(logs, `${s.name}.log`))}
<key>StandardErrorPath</key>${string(resolve(logs, `${s.name}.error.log`))}
</dict></plist>\n`;
    await writeFile(s.plist, xml, { mode: 0o600 });
    await run("/bin/launchctl", ["bootstrap", domain, s.plist]);
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await Promise.all(services.map(health))).every(Boolean)) {
      await status();
      return;
    }
    await delay(1000);
  }
  await status();
  throw new Error(`服务尚未全部就绪，请查看 ${logs}；没有创建或替换业务运行。`);
}
await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
