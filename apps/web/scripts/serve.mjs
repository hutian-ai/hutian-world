// Static hosting and same-origin reverse proxy only. No Hutian credentials or business code.
import { createServer, request as proxyRequest } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
};
createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1:3340").pathname;
  if (path.startsWith("/api/")) {
    const upstream = proxyRequest(
      {
        hostname: "127.0.0.1",
        port: 3341,
        path: /^\/api\/v[12]\//.test(req.url) ? req.url.slice(4) : req.url,
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.on("aborted", () => res.destroy());
        response.on("error", () => res.destroy());
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent)
        res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("后端暂不可连接。");
    });
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
    return;
  }
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    let file = resolve(root, "." + decodeURIComponent(path));
    if (!file.startsWith(resolve(root) + sep) && file !== resolve(root))
      throw new Error();
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      if (extname(path)) {
        res.writeHead(404);
        res.end();
        return;
      }
      file = resolve(root, "index.html");
    }
    res.writeHead(200, {
      "content-type": mime[extname(file)] ?? "application/octet-stream",
      "cache-control": file.endsWith(".html")
        ? "no-cache"
        : "public, max-age=3600",
      "x-content-type-options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(3340, "127.0.0.1", () =>
  console.log("hutian Web 静态资源：http://127.0.0.1:3340"),
);
