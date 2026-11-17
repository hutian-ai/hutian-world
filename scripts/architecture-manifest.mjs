import { readFile, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const components = {
  world: root,
  communication: resolve(root, "../matrix-team-chat"),
  design: resolve(root, "../hutian-design"),
  memory: resolve(root, "../memory-access"),
  knowledge: resolve(root, "../knowledge-gateway"),
};
const versions = {};
for (const [name, cwd] of Object.entries(components)) {
  const packageData = await readFile(resolve(cwd, "package.json"), "utf8")
    .then(JSON.parse)
    .catch(() => ({ version: "source" }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  let commit = null,
    dirty = null;
  try {
    commit = git("rev-parse", "HEAD");
    dirty = Boolean(git("status", "--porcelain"));
  } catch {
    // A source distribution may not include Git metadata.
  }
  let sourceSha256 = null;
  try {
    const hash = createHash("sha256");
    const files = [
      ...new Set(
        git("ls-files", "-co", "--exclude-standard", "-z")
          .split("\0")
          .filter(Boolean),
      ),
    ].sort();
    for (const path of files) {
      if (path.startsWith(".local/")) continue;
      const full = resolve(cwd, path);
      if (!(await lstat(full).catch(() => null))?.isFile()) continue;
      hash.update(path + "\0");
      hash.update(await readFile(full));
      hash.update("\0");
    }
    sourceSha256 = hash.digest("hex");
  } catch {
    // Leave the fingerprint null when the source tree cannot be read.
  }
  const lock = await readFile(resolve(cwd, "pnpm-lock.yaml")).catch(() => null);
  versions[name] = {
    version: packageData.version,
    commit,
    dirty,
    sourceSha256,
    lockSha256: lock ? createHash("sha256").update(lock).digest("hex") : null,
  };
}
console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      protocols: {
        http: 2,
        host: 1,
        chatWorkflow: "chat-v1",
        memory: ["v1", "v2"],
        knowledge: "v1",
      },
      components: versions,
    },
    null,
    2,
  ),
);
