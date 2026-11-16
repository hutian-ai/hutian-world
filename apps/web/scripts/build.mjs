import { build } from "vite";
import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const web = fileURLToPath(new URL("../", import.meta.url));
const live = join(web, "dist");
const privateRoot = resolve(web, "../../.local/web-build");
const previous = join(privateRoot, "previous-index.html");

// Renaming on the destination filesystem exposes a complete file to readers.
async function replaceFile(source, target) {
  await mkdir(dirname(target), { recursive: true });
  const pending = `${target}.${randomUUID()}.pending`;
  try {
    await copyFile(source, pending);
    await rename(pending, target);
  } finally {
    await rm(pending, { force: true });
  }
}

async function outputFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".vite") continue;
    const relative = join(prefix, entry.name);
    if (entry.isDirectory())
      files.push(...(await outputFiles(join(directory, entry.name), relative)));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`构建产物包含不支持的文件类型：${relative}`);
  }
  return files;
}

async function verifyBuild(directory) {
  const html = await readFile(join(directory, "index.html"), "utf8");
  const manifest = JSON.parse(
    await readFile(join(directory, ".vite/manifest.json"), "utf8"),
  );
  if (
    !manifest["index.html"]?.isEntry ||
    !html.includes(manifest["index.html"].file)
  )
    throw new Error("构建入口与资源清单不匹配，保留当前页面。");
  for (const chunk of Object.values(manifest)) {
    for (const dependency of [
      ...(chunk.imports ?? []),
      ...(chunk.dynamicImports ?? []),
    ])
      if (!manifest[dependency]) throw new Error(`构建依赖缺失：${dependency}`);
    for (const file of [
      chunk.file,
      ...(chunk.css ?? []),
      ...(chunk.assets ?? []),
    ]) {
      const target = resolve(directory, file);
      if (
        !target.startsWith(resolve(directory) + sep) ||
        !(await stat(target)).isFile()
      )
        throw new Error(`构建资源无效：${file}`);
    }
  }
  return html;
}

// This publishes static files only; the API and execution host keep running.
export async function publishBuild(directory) {
  await verifyBuild(directory);
  const files = await outputFiles(directory);
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  await mkdir(live, { recursive: true });
  for (const file of files) {
    if (file !== "index.html")
      await replaceFile(join(directory, file), join(live, file));
  }
  // Old hashed assets remain available to already-open tabs and rollback.
  const current = join(live, "index.html");
  const exists = await stat(current).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (exists) await replaceFile(current, previous);
  await replaceFile(join(directory, "index.html"), current);
}

async function rollback() {
  const html = await readFile(previous, "utf8").catch((error) => {
    if (error.code === "ENOENT") throw new Error("没有可回退的前端入口。");
    throw error;
  });
  const pending = join(privateRoot, `rollback-${randomUUID()}.html`);
  try {
    await writeFile(pending, html);
    await replaceFile(join(live, "index.html"), previous);
    await replaceFile(pending, join(live, "index.html"));
  } finally {
    await rm(pending, { force: true });
  }
  console.log("已恢复上一版前端入口；API 与执行中的工作未重启。");
}

async function main() {
  if (process.argv[2] === "--rollback") return rollback();
  if (process.argv.length > 2)
    throw new Error("用法：pnpm build 或 pnpm rollback");
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const stage = await mkdtemp(join(privateRoot, "stage-"));
  const version = `${new Date().toISOString()}-${randomUUID().slice(0, 8)}`;
  try {
    await build({
      root: web,
      plugins: [
        {
          name: "hutian-build-version",
          transformIndexHtml: () => [
            {
              tag: "meta",
              attrs: { name: "hutian-build", content: version },
              injectTo: "head",
            },
          ],
        },
      ],
      build: { outDir: stage, emptyOutDir: true, manifest: true },
    });
    await publishBuild(stage);
    console.log(`前端已更新：${version}`);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  await main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
