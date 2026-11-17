"use client";
import { OrganizationMarkdown } from "@/components/organization-markdown";
import Link, { useRouter, useSearchParams } from "@/lib/navigation";
import {
  findResources,
  loadResources,
  observeMemory,
  readKnowledgeSource,
  readMemorySource,
  saveResource,
} from "@/lib/resource-actions";
import type { ResourceScope } from "@/lib/resource-scopes";
import type { Reference } from "@/lib/resources";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { Button } from "@hutian-ai/design/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@hutian-ai/design/ui/dialog";
import { Input } from "@hutian-ai/design/ui/input";
import { Textarea } from "@hutian-ai/design/ui/textarea";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Brain,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Document = {
  id: string;
  title: string;
  sourceTitle?: string;
  content?: string;
  createdAt?: string;
  status?: string;
  version?: number;
};

function savedTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
export function ResourceWorkspace({
  kind,
  scope,
  scopeLabel,
}: {
  kind: "memory" | "knowledge";
  scope: ResourceScope;
  scopeLabel: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const initialSource = params.get("source") ?? undefined;
  function selectSource(id?: string) {
    const next = new URLSearchParams(params);
    if (id) next.set("source", id);
    else next.delete("source");
    router.push(`/${kind}${next.size ? `?${next}` : ""}`);
  }
  const isMemory = kind === "memory";
  const title = isMemory ? "记忆" : "知识库";
  const Icon = isMemory ? Brain : BookOpen;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Document>();
  const [content, setContent] = useState("");
  const [sourceVersion, setSourceVersion] = useState("");
  const selectedSource = useRef("");
  const loadVersion = useRef(0);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Reference[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [reading, setReading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const reader = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const retry = useRef<{ key: string; id: string } | null>(null);
  const sourceHeading = content
    .trimStart()
    .match(/^#{1,2}[ \t]+(.+?)(?:[ \t]+#+)?(?:\r?\n|$)/)?.[1]
    .trim();
  const hasSourceHeading =
    sourceHeading &&
    (sourceHeading === selected?.title.trim() ||
      sourceHeading === selected?.sourceTitle);
  useEffect(() => {
    reader.current?.scrollTo({ top: 0 });
  }, [selected?.id, results]);
  async function choose(doc: Document) {
    selectedSource.current = doc.id;
    setResults(null);
    setReading(true);
    setError("");
    setSelected(doc);
    setContent(doc.content ?? "");
    setSourceLoading(isMemory);
    setSourceVersion(isMemory ? "" : String(doc.version ?? 1));
    if (isMemory) {
      const r = await readMemorySource(doc.id, scope);
      if (selectedSource.current !== doc.id) return;
      setSourceLoading(false);
      if (r.ok) {
        setContent(String(r.data.original_text ?? "原文暂不可读取。"));
        setSourceVersion(
          String(r.data.document_metadata?.source_version ?? ""),
        );
      } else setError(r.error);
    }
  }
  async function load() {
    const version = ++loadVersion.current;
    const source = initialSource ?? "";
    selectedSource.current = source;
    setResults(null);
    if (!source || selected?.id !== source) {
      setSelected(undefined);
      setContent("");
      setReading(Boolean(source));
      setSourceLoading(Boolean(source));
    }
    const r = await loadResources(kind, scope);
    if (version !== loadVersion.current) return;
    if (r.ok) {
      const docs = r.data.documents as Document[];
      setDocuments(docs);
      setNextCursor(r.data.nextCursor);
      setError("");
      if (initialSource) {
        const d = docs.find((d) => d.id === initialSource);
        if (d) await choose(d);
        else if (!isMemory) {
          const original = await readKnowledgeSource(initialSource, scope);
          if (version !== loadVersion.current) return;
          if (original.ok) await choose(original.data);
          else setError(original.error);
        } else {
          const original = await readMemorySource(initialSource, scope);
          if (version !== loadVersion.current) return;
          if (original.ok) {
            const sourceText = String(original.data.original_text ?? "");
            await choose({
              id: initialSource,
              title:
                sourceText.trimStart().match(/^#{1,2}\s+([^\n]+)/)?.[1] ??
                "记忆来源",
              createdAt: "",
              status: "saved",
            });
          } else setError(original.error);
        }
      }
    } else setError(r.error);
    if (version !== loadVersion.current) return;
    setSourceLoading(false);
    setLoaded(true);
  }
  useEffect(() => {
    void load();
  }, [kind, initialSource]);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => {
      void observeMemory(pending, scope).then((r) => {
        if (!r.ok) {
          setError(r.error);
          return;
        }
        const status = r.data.status;
        if (status === "completed" || status === "failed") {
          setPending("");
          setNotice(
            status === "completed"
              ? "记忆整理已完成；能否召回以实际检索结果为准。"
              : "整理未完成，原操作保留，请核对后再继续。",
          );
          void load();
        }
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [pending]);
  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const version = loadVersion.current;
    setLoadingMore(true);
    try {
      const result = await loadResources(kind, scope, nextCursor);
      if (version !== loadVersion.current) return;
      if (result.ok) {
        setDocuments((old) => [
          ...new Map(
            [...old, ...(result.data.documents as Document[])].map((doc) => [
              doc.id,
              doc,
            ]),
          ).values(),
        ]);
        setNextCursor(result.data.nextCursor);
      } else setError(result.error);
    } finally {
      setLoadingMore(false);
    }
  }
  async function save() {
    const key = JSON.stringify({ name, text, scope });
    const req =
      retry.current?.key === key
        ? retry.current
        : { key, id: crypto.randomUUID() };
    retry.current = req;
    setBusy(true);
    setError("");
    try {
      const r = await saveResource(
        kind,
        {
          id: req.id,
          title: name,
          content: text,
        },
        scope,
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (isMemory) {
        setPending(req.id);
        setNotice("原文已提交，正在整理记忆；完成后才可召回。");
      } else
        setNotice(
          r.data.status === "ready"
            ? "原文与索引已保存，可以在对话中使用知识库。"
            : r.data.status === "failed"
              ? "索引失败，原文已保留，暂不参与检索。"
              : "原文已保存，索引结果待核对，暂不参与检索。",
        );
      retry.current = null;
      setOpen(false);
      setName("");
      setText("");
      await load();
      if (!isMemory) await choose(r.data as Document);
    } catch {
      setError("结果未确认，请沿原操作核对。");
    } finally {
      setBusy(false);
    }
  }
  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const r = await findResources(kind, query, scope);
    if (r.ok) {
      setResults(r.references);
      setReading(true);
      setError("");
    } else setError(r.error);
    setSearching(false);
  }
  return (
    <div className="workspace-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-primary/5 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold break-words">
            {title} · {scopeLabel}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isMemory
              ? "保存明确的偏好与决定，让下一次对话接着往前。"
              : "把有出处的资料带进对话，原文始终可以核对。"}
          </p>
        </div>
        <div className="ml-auto flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`刷新${title}`}
            onClick={() => void load()}
          >
            <RefreshCw />
          </Button>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              if (!busy) setOpen(v);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-3.5" />
                {isMemory ? "记下一条" : "添加资料"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {isMemory ? "保存一条记忆" : "添加 Markdown 资料"}
                </DialogTitle>
                <DialogDescription>
                  {isMemory
                    ? "只记录你明确希望保留的事实、偏好或决定。"
                    : "原文先持久保存，再交给知识服务建立索引。保存后仅在所选范围内检索。"}
                </DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                保存到：{scopeLabel}
                {scope.kind === "conversation"
                  ? "。本会话成员可使用，请确认内容可以共享。"
                  : "。不会自动提供给其他角色或会话。"}
              </p>
              <Input
                aria-label="标题"
                placeholder={isMemory ? "例如：我的沟通偏好" : "资料名称"}
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {!isMemory && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Upload className="size-3.5" />
                  选择 Markdown 文件
                  <input
                    className="max-w-64 text-xs"
                    type="file"
                    accept=".md,text/markdown"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 60000) {
                        setError("首版支持 60 KB 以内的 Markdown。");
                        return;
                      }
                      setName(f.name.replace(/\.md$/i, ""));
                      setText(await f.text());
                    }}
                  />
                </label>
              )}
              <Textarea
                className="min-h-64 font-mono text-xs"
                aria-label="正文"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  isMemory
                    ? "写下希望下次继续使用的信息…"
                    : "粘贴 Markdown 原文…"
                }
              />
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                disabled={busy || !name.trim() || !text.trim()}
                onClick={() => void save()}
              >
                {busy
                  ? "正在保存…"
                  : isMemory
                    ? "保存并整理"
                    : "保存原文并建立索引"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      {error && (
        <Alert className="m-4 w-auto shrink-0" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <p
          role="status"
          className="shrink-0 border-b bg-primary/5 px-5 py-3 text-xs text-muted-foreground"
        >
          {notice}
        </p>
      )}
      <div className="resource-workbench" data-focused={reading}>
        <aside className="resource-directory">
          <div className="flex shrink-0 gap-2 border-b p-3">
            <Input
              className="h-8 min-w-0 text-xs"
              aria-label={`检索${title}`}
              placeholder={isMemory ? "找一条记得的事…" : "检索资料内容…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
            />
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="检索"
              disabled={searching}
              onClick={() => void search()}
            >
              <Search className="size-3.5" />
            </Button>
          </div>
          <p className="shrink-0 px-4 pt-4 pb-2 text-[11px] text-muted-foreground">
            {loaded ? `${documents.length} 份已保存原文` : "正在连接资源服务…"}
          </p>
          <nav
            aria-label={`${title}原文目录`}
            className="grid min-h-0 content-start gap-1 overflow-y-auto overscroll-contain p-2"
          >
            {documents.map((doc) => (
              <Button
                key={doc.id}
                variant="ghost"
                aria-current={selected?.id === doc.id ? "true" : undefined}
                className={`h-auto min-h-16 w-full min-w-0 justify-start gap-2.5 text-left ${selected?.id === doc.id ? "bg-accent" : ""}`}
                onClick={() => selectSource(doc.id)}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span
                    title={doc.title}
                    className="line-clamp-2 text-xs leading-5 font-normal whitespace-normal break-words"
                  >
                    {doc.title}
                  </span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {doc.status === "ready"
                      ? `可检索 · 版本 ${doc.version ?? 1}`
                      : doc.status === "failed"
                        ? "索引失败 · 原文保留"
                        : doc.status === "unknown" || doc.status === "indexing"
                          ? "索引待核对"
                          : "原文已保存"}
                  </span>
                  {savedTime(doc.createdAt) && (
                    <time
                      dateTime={doc.createdAt}
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      {savedTime(doc.createdAt)}
                    </time>
                  )}
                </span>
              </Button>
            ))}
          </nav>
        </aside>
        <section aria-label={`${title}阅读区`} className="resource-detail">
          <div className="resource-back shrink-0 border-b px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReading(false);
                selectSource();
              }}
            >
              <ArrowLeft className="size-4" />
              返回目录
            </Button>
            {nextCursor && (
              <Button
                variant="ghost"
                className="w-full"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "正在读取…" : "读取更多原文"}
              </Button>
            )}
          </div>
          <div
            ref={reader}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 lg:p-8"
          >
            <div className="resource-reading-column mx-auto w-full max-w-[52rem] min-w-0">
              {results ? (
                <>
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-sm">检索结果 · {results.length}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setResults(null)}
                    >
                      返回原文
                    </Button>
                  </div>
                  {results.length ? (
                    results.map((r, i) => (
                      <article
                        key={`${r.id}-${i}`}
                        className="mb-4 rounded-md border p-4"
                      >
                        <p className="mb-2 text-xs text-muted-foreground">
                          {r.title} · {r.version}
                        </p>
                        <OrganizationMarkdown content={r.text} />
                        <Link
                          className="mt-3 inline-flex items-center gap-1 text-xs text-primary"
                          href={r.url}
                        >
                          核对出处
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      没有命中可用内容。新记忆需等待整理完成，新资料需完成索引。
                    </p>
                  )}
                </>
              ) : !selected && initialSource ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {sourceLoading
                    ? "正在读取原文…"
                    : "所选原文暂不可读取，请返回目录或重试。"}
                </p>
              ) : selected ? (
                <>
                  <p className="mb-4 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {isMemory ? "记忆来源原文" : "Markdown 原文"} ·{" "}
                    <span title={sourceVersion}>
                      {sourceVersion
                        ? `版本 ${sourceVersion.length > 16 ? sourceVersion.slice(0, 12) : sourceVersion}`
                        : "版本未提供"}
                    </span>
                    {savedTime(selected.createdAt) && (
                      <time dateTime={selected.createdAt}>
                        · {savedTime(selected.createdAt)}
                      </time>
                    )}
                  </p>
                  {!hasSourceHeading && (
                    <h2 className="mb-5 text-xl font-semibold break-words">
                      {selected.title}
                    </h2>
                  )}
                  {sourceLoading ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      正在读取原文…
                    </p>
                  ) : (
                    <OrganizationMarkdown
                      content={content}
                      components={
                        selected.sourceTitle
                          ? {
                              h1: ({ node, children }) => (
                                <h1>
                                  {node?.position?.start.offset ===
                                  content.indexOf("#")
                                    ? selected.title
                                    : children}
                                </h1>
                              ),
                              h2: ({ node, children }) => (
                                <h2>
                                  {node?.position?.start.offset ===
                                  content.indexOf("#")
                                    ? selected.title
                                    : children}
                                </h2>
                              ),
                            }
                          : undefined
                      }
                    />
                  )}
                </>
              ) : (
                <div className="mx-auto flex max-w-md flex-col items-start pt-16">
                  <Icon className="mb-5 size-7 text-primary" />
                  <h2 className="text-xl font-medium">
                    {isMemory ? "让有价值的经验留下来" : "让每个回答都有据可查"}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {isMemory
                      ? "聊天历史不会自动全部变成记忆。先保存你认可的信息，再在对话输入区启用记忆检索。"
                      : "添加一份 Markdown，等待索引完成。在对话输入区启用知识库后，助手会获得相关片段和可打开的原文来源。"}
                  </p>
                  <Button asChild variant="outline" className="mt-6">
                    <Link href="/chat">
                      回到对话
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
