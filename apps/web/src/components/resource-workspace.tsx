"use client";
import Link from "@/lib/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Brain,
  FileText,
  Plus,
  Search,
  RefreshCw,
  ArrowUpRight,
  Upload,
} from "lucide-react";
import { Button } from "@hutian-ai/design/ui/button";
import { Input } from "@hutian-ai/design/ui/input";
import { Textarea } from "@hutian-ai/design/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@hutian-ai/design/ui/dialog";
import { Alert, AlertDescription } from "@hutian-ai/design/ui/alert";
import { OrganizationMarkdown } from "@/components/organization-markdown";
import {
  findResources,
  loadResources,
  observeMemory,
  readMemorySource,
  readKnowledgeSource,
  saveResource,
} from "@/lib/resource-actions";
import type { ResourceScope } from "@/lib/resource-scopes";
import type { Reference } from "@/lib/resources";

type Document = {
  id: string;
  title: string;
  content?: string;
  createdAt?: string;
  status?: string;
  version?: number;
};
export function ResourceWorkspace({
  kind,
  initialSource,
  scope,
  scopeLabel,
}: {
  kind: "memory" | "knowledge";
  initialSource?: string;
  scope: ResourceScope;
  scopeLabel: string;
}) {
  const isMemory = kind === "memory";
  const title = isMemory ? "记忆" : "知识库";
  const Icon = isMemory ? Brain : BookOpen;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Document>();
  const [content, setContent] = useState("");
  const [sourceVersion, setSourceVersion] = useState("");
  const selectedSource = useRef("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Reference[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const retry = useRef<{ key: string; id: string } | null>(null);
  async function choose(doc: Document) {
    selectedSource.current = doc.id;
    setSelected(doc);
    setContent(doc.content ?? "");
    setSourceVersion(isMemory ? "" : String(doc.version ?? 1));
    if (isMemory) {
      const r = await readMemorySource(doc.id, scope);
      if (selectedSource.current !== doc.id) return;
      if (r.ok) {
        setContent(String(r.data.original_text ?? "原文暂不可读取。"));
        setSourceVersion(
          String(r.data.document_metadata?.source_version ?? ""),
        );
      } else setError(r.error);
    }
  }
  async function load() {
    const r = await loadResources(kind, scope);
    if (r.ok) {
      const docs = r.data.documents as Document[];
      setDocuments(docs);
      setError("");
      if (initialSource) {
        const d = docs.find((d) => d.id === initialSource);
        if (d) await choose(d);
        else if (!isMemory) {
          const original = await readKnowledgeSource(initialSource, scope);
          if (original.ok) await choose(original.data);
          else setError(original.error);
        } else
          setError(
            "这份原文暂不可读取，可能仍在处理中、已删除或当前范围不可访问。",
          );
      }
    } else setError(r.error);
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
      setError("");
    } else setError(r.error);
    setSearching(false);
  }
  return (
    <div className="workspace-surface flex min-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-lg border">
      <header className="flex min-h-16 items-center gap-3 border-b px-5">
        <span className="flex size-8 items-center justify-center rounded-md border bg-primary/5 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">
            {title} · {scopeLabel}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isMemory
              ? "保存明确的偏好与决定，让下一次对话接着往前。"
              : "把有出处的资料带进对话，原文始终可以核对。"}
          </p>
        </div>
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
                isMemory ? "写下希望下次继续使用的信息…" : "粘贴 Markdown 原文…"
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
      </header>
      {error && (
        <Alert className="m-4 w-auto" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <p
          role="status"
          className="border-b bg-primary/5 px-5 py-3 text-xs text-muted-foreground"
        >
          {notice}
        </p>
      )}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b md:w-72 md:border-r md:border-b-0">
          <div className="flex gap-2 border-b p-3">
            <Input
              className="h-8 text-xs"
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
          <p className="px-4 pt-4 pb-2 text-[11px] text-muted-foreground">
            {loaded ? `${documents.length} 份已保存原文` : "正在连接资源服务…"}
          </p>
          <nav className="grid max-h-[55dvh] gap-1 overflow-y-auto p-2">
            {documents.map((doc) => (
              <Button
                key={doc.id}
                variant="ghost"
                className={`h-auto min-h-14 justify-start gap-2.5 text-left ${selected?.id === doc.id ? "bg-accent" : ""}`}
                onClick={() => void choose(doc)}
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-xs font-normal">
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
                </span>
              </Button>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-6 lg:p-8">
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
          ) : selected ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {isMemory ? "记忆来源原文" : "Markdown 原文"} ·{" "}
                <span title={sourceVersion}>
                  {sourceVersion
                    ? `版本 ${sourceVersion.length > 16 ? sourceVersion.slice(0, 12) : sourceVersion}`
                    : "版本未提供"}
                </span>
              </p>
              <h2 className="mb-5 text-xl font-medium">{selected.title}</h2>
              <OrganizationMarkdown content={content} />
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
        </main>
      </div>
    </div>
  );
}
