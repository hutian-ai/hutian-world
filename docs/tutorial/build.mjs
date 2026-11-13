// Build the offline reading edition from the repository's Markdown and images.
// Reuses the Web app's installed dependencies; installs nothing.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const [{ default: React }, { renderToStaticMarkup }, { default: Markdown }, { default: remarkGfm }] =
  await Promise.all([
    import(pathToFileURL(app.resolve("react"))),
    import(pathToFileURL(app.resolve("react-dom/server"))),
    import(pathToFileURL(app.resolve("react-markdown"))),
    import(pathToFileURL(app.resolve("remark-gfm"))),
  ]);
const h = React.createElement;
const markdown = await readFile(resolve(here, "TECHNICAL.md"), "utf8");
const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((m, i) => ({ title: m[1], id: `chapter-${i + 1}` }));
const imagePaths = [...markdown.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
const diagramCount = imagePaths.filter((path) => path.endsWith(".svg")).length;
const screenshotCount = imagePaths.length - diagramCount;
const images = new Map(await Promise.all(imagePaths.map(async (path) => [
  path,
  `data:${extname(path) === ".svg" ? "image/svg+xml" : "image/png"};base64,${(await readFile(resolve(here, path))).toString("base64")}`,
])));

const content = renderToStaticMarkup(h(Markdown, {
  remarkPlugins: [remarkGfm],
  components: {
    h2: ({ children }) => h("h2", { id: headings.find((x) => x.title === String(children))?.id }, children),
    img: ({ src, alt }) => h("button", { className: "image-open", type: "button", "aria-label": `放大查看：${alt}` },
      h("img", { src: images.get(src), alt, loading: "lazy" })),
    a: ({ href, children }) => {
      if (href?.startsWith("http")) return h("a", { href, target: "_blank", rel: "noreferrer" }, children);
      if (href?.endsWith(".html")) return h("a", { href, target: "_blank", rel: "noreferrer" }, children);
      const [path, fragment] = (href ?? "").split("#");
      const line = fragment?.match(/^L(\d+)$/)?.[1];
      return h("button", { className: "source-link", type: "button", "data-source": resolve(here, path) + (line ? `:${line}` : ""), title: "复制本机文件路径与行号" }, children);
    },
    pre: ({ children }) => h("div", { className: "code-block" },
      h("button", { type: "button", className: "copy-code" }, "复制"), h("pre", null, children)),
    table: ({ children }) => h("div", { className: "table-scroll" }, h("table", null, children)),
  },
}, markdown));
const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const toc = headings.map((x, i) => `<a href="#${x.id}"><span>${String(i + 1).padStart(2, "0")}</span>${escape(x.title.replace(/^\d+\. /, ""))}</a>`).join("\n");

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="接手 hutian 开发：启动与调试、数据库 ER 图、函数调用链、请求契约、宿主状态与第一次代码改动。">
<title>hutian 开发接手手册</title>
<style>
:root{--paper:#f7f7f2;--surface:#fff;--ink:#233c33;--muted:#607166;--line:#dce3da;--accent:#176c4c;--soft:#e7efe5;--code:#12281f;--code-ink:#e0eee3;--shadow:0 12px 50px #18392f0c;color-scheme:light}
:root[data-theme="dark"]{--paper:#101914;--surface:#16231c;--ink:#e0eae0;--muted:#a7b8aa;--line:#304238;--accent:#8ad5ab;--soft:#20382a;--code:#0b130e;--code-ink:#e0eee3;--shadow:none;color-scheme:dark}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:86px}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.85 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}button,a{-webkit-tap-highlight-color:transparent}button{font:inherit}a{color:var(--accent);text-underline-offset:4px}button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:4px}button{cursor:pointer}::selection{background:var(--soft)}
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px max(24px,calc((100vw - 1280px)/2));background:var(--paper);border-bottom:1px solid var(--line)}.brand{font-weight:650;letter-spacing:.03em;white-space:nowrap}.brand span{margin-left:12px;color:var(--muted);font-size:12px;font-weight:450;letter-spacing:.12em}.tools{display:flex;flex-wrap:wrap;gap:8px}.tools button,.tools a{color:var(--ink);background:var(--surface);border:1px solid var(--line);padding:6px 12px;border-radius:7px;text-decoration:none;font-size:12px}.tools a{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.layout{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:236px minmax(0,1fr);gap:58px;padding:44px 24px 100px}.sidebar{position:sticky;top:104px;align-self:start}.eyebrow{color:var(--accent);font-size:11px;letter-spacing:.16em;font-weight:650;text-transform:uppercase}.sidebar nav{margin-top:18px;display:grid;gap:5px}.sidebar nav a{display:flex;gap:12px;text-decoration:none;color:var(--muted);font-size:13px;padding:9px 10px;border-radius:7px;line-height:1.65}.sidebar nav a span{font-size:11px;opacity:.7;font-variant-numeric:tabular-nums;margin-top:2px}.sidebar nav a.active,.sidebar nav a:hover{background:var(--soft);color:var(--ink)}.side-note{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:18px;margin-top:24px;line-height:1.85}
main{min-width:0;max-width:920px}header.intro{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:24px}.badge{font-size:11px;letter-spacing:.03em;padding:3px 10px;border:1px solid var(--line);border-radius:30px;color:var(--muted)}article>h1{font-size:clamp(30px,3.7vw,44px);line-height:1.35;letter-spacing:-.04em;font-weight:650;margin:0 0 26px}article>p:first-of-type{font-size:19px;line-height:1.85;color:var(--ink);margin-bottom:18px}p{margin:16px 0}h2{font-size:26px;line-height:1.45;letter-spacing:-.02em;margin:70px 0 22px;padding-top:26px;border-top:1px solid var(--line);font-weight:650}h3{font-size:19px;margin:34px 0 12px;font-weight:650}strong{font-weight:650}li{margin:9px 0}ul,ol{padding-left:25px}em{font-size:13px;color:var(--muted);font-style:normal}p:has(>em:only-child){margin:9px 0 28px;line-height:1.75}code{font: .86em/1.7 "SFMono-Regular",Consolas,"Liberation Mono",monospace;background:var(--soft);padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}pre{margin:0;padding:24px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--code-ink);line-height:1.75}pre code{font-size:12.5px;line-height:1.75;background:none;padding:0;color:inherit;overflow-wrap:anywhere}.code-block{position:relative;background:var(--code);border-radius:10px;margin:20px 0;overflow:hidden}.copy-code{position:absolute;top:8px;right:9px;font-size:11px;color:var(--code-ink);background:transparent;border:1px solid #ffffff32;border-radius:4px;padding:2px 7px}.code-block pre{padding-top:38px}
.source-link{display:inline;color:var(--accent);padding:0;border:0;background:none;text-decoration:underline;text-underline-offset:4px;font-size:inherit;overflow-wrap:anywhere}.table-scroll{overflow-x:auto;margin:24px 0;border:1px solid var(--line);border-radius:9px;background:var(--surface);box-shadow:var(--shadow)}table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.8}th{text-align:left;color:var(--muted);font-weight:550;background:var(--soft);white-space:nowrap}th,td{padding:12px 15px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}tr:last-child td{border-bottom:0}td:first-child{font-weight:550}td code{font-size:11px}article p:has(.image-open){margin:28px 0 4px}.image-open{display:block;width:100%;padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface);box-shadow:var(--shadow);cursor:zoom-in;line-height:0}.image-open img{width:100%;height:auto;display:block}.endnote{border-top:1px solid var(--line);color:var(--muted);font-size:12px;margin-top:54px;padding-top:24px}
dialog{border:1px solid var(--line);padding:44px 12px 12px;border-radius:12px;background:var(--surface);color:var(--ink);max-width:96vw;max-height:96vh}dialog::backdrop{background:#07160fd9}dialog img{display:block;max-width:90vw;max-height:82vh;object-fit:contain}dialog button{position:absolute;right:12px;top:8px;background:var(--soft);color:var(--ink);border:0;border-radius:6px;padding:3px 12px;font-size:13px}#toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;background:var(--ink);color:var(--paper);z-index:50;font-size:13px;max-width:90vw;text-align:center}#toast:empty{display:none}
@media(max-width:960px){.layout{gap:26px;grid-template-columns:190px minmax(0,1fr);padding-top:30px}.sidebar nav a{font-size:12px;padding:8px 5px}.brand span{display:none}article>h1{font-size:32px}h2{font-size:23px}}
@media(max-width:700px){.topbar{padding:12px 16px}.tools{gap:5px}.tools button,.tools a{padding:5px 8px;font-size:11px}.layout{display:block;padding:24px 18px 65px}.sidebar{position:static;margin-bottom:32px}.sidebar nav{grid-template-columns:1fr 1fr;gap:3px;margin-top:10px}.sidebar nav a{font-size:12px}.side-note{display:none}header.intro{margin-bottom:16px}article>h1{font-size:29px}article>p:first-of-type{font-size:17px}body{font-size:15px}h2{margin-top:50px;font-size:22px}th,td{padding:10px;min-width:105px}pre{padding:18px}dialog{padding:40px 5px 5px}.badge{font-size:10px}}
@media print{html{scroll-behavior:auto}body{background:white;color:#1a3027;font-size:10pt}.topbar,.sidebar,.intro,.copy-code,#toast,dialog{display:none!important}.layout{display:block;max-width:none;padding:0}main{max-width:none}h1{font-size:27pt!important}h2{break-after:avoid;font-size:18pt;margin-top:30px}h3{break-after:avoid}p:has(.image-open),.table-scroll,.code-block{break-inside:avoid}.table-scroll{overflow:visible}.image-open{border:0;box-shadow:none}.image-open img{max-height:170mm;object-fit:contain}.code-block{background:#f0f4ee}pre{color:#163128}article>h1:before{content:"hutian · 实现导读 / 2026-11-13";display:block;font-size:9pt;letter-spacing:.1em;margin-bottom:18px}.source-link{color:#145c40;text-decoration:none}a{color:#145c40}.endnote{font-size:9pt}}
</style>
</head>
<body>
<div class="topbar"><div class="brand">hutian <span>DEVELOPMENT GUIDE</span></div><div class="tools"><button type="button" id="theme-toggle">切换深色</button><button type="button" id="print-guide">打印 / PDF</button><a href="http://127.0.0.1:3340/chat" target="_blank" rel="noreferrer">打开 hutian ↗</a></div></div>
<div class="layout"><aside class="sidebar"><div class="eyebrow">开发接手 · 代码与数据</div><nav aria-label="教程目录">${toc}</nav><div class="side-note">从进程、调用栈和数据开始。<br>配图可放大；源码链接复制路径与行号，可粘贴到编辑器打开。<br><br>先看第 2、3、4、5、9 节。</div></aside><main><header class="intro"><span class="eyebrow">DEVELOPER HANDOFF</span><span class="badge">2026-11-13 · 当前源码</span><span class="badge">${diagramCount} 张技术图 · ${screenshotCount} 张真实截图</span></header><article>${content}</article><footer class="endnote">正文：docs/tutorial/TECHNICAL.md。配图已内嵌，可离线阅读。当前未公开发布；产品流程保留在附录，后续建议未混入已实现范围。</footer></main></div>
<dialog id="image-dialog" aria-label="配图大图"><button type="button" id="close-image">关闭 · Esc</button><img id="large-image" alt=""></dialog><div id="toast" role="status" aria-live="polite"></div>
<script>
const docRoot=document.documentElement;
const themeButton=document.getElementById('theme-toggle');
function setTheme(dark){docRoot.dataset.theme=dark?'dark':'light';themeButton.textContent=dark?'切换浅色':'切换深色';}
setTheme(false);themeButton.addEventListener('click',()=>setTheme(docRoot.dataset.theme!=='dark'));
document.getElementById('print-guide').addEventListener('click',()=>window.print());
let timer;function notice(message){const t=document.getElementById('toast');t.textContent=message;clearTimeout(timer);timer=setTimeout(()=>t.textContent='',3200);}
async function copy(text){try{await navigator.clipboard.writeText(text);notice('已复制');}catch{const input=document.createElement('textarea');input.value=text;document.body.append(input);input.select();const done=document.execCommand('copy');input.remove();notice(done?'已复制':'请在 Markdown 正文中查看路径');}}
document.querySelectorAll('[data-source]').forEach(b=>b.addEventListener('click',()=>copy(b.dataset.source)));
document.querySelectorAll('.copy-code').forEach(b=>b.addEventListener('click',()=>copy(b.parentElement.querySelector('pre').textContent)));
const dialog=document.getElementById('image-dialog'),large=document.getElementById('large-image');
document.querySelectorAll('.image-open').forEach(b=>b.addEventListener('click',()=>{const img=b.querySelector('img');large.src=img.src;large.alt=img.alt;dialog.showModal();}));
document.getElementById('close-image').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
const nav=[...document.querySelectorAll('.sidebar nav a')];
const observer=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;nav.forEach(a=>a.classList.toggle('active',a.hash==='#'+e.target.id));}},{rootMargin:'-10% 0px -72% 0px'});
document.querySelectorAll('article h2').forEach(el=>observer.observe(el));
</script>
</body></html>`;
await writeFile(resolve(here, "index.html"), html);
console.log(`Built illustrated guide: ${headings.length} chapters, ${images.size} images, ${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB`);
