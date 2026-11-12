"use client";

import { Bold, Code, Heading2, Italic, Link, List, Quote } from "lucide-react";
import { useRef, useState } from "react";
import { OrganizationMarkdown } from "@/components/organization-markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { markdownEdit, type MarkdownFormat } from "@/lib/organization-markdown-edit";
import { cn } from "@/lib/utils";

const formats = [
  { value: "heading", label: "标题", icon: Heading2 },
  { value: "bold", label: "粗体", icon: Bold, shortcut: "⌘/Ctrl+B" },
  { value: "italic", label: "斜体", icon: Italic, shortcut: "⌘/Ctrl+I" },
  { value: "list", label: "列表", icon: List },
  { value: "quote", label: "引用", icon: Quote },
  { value: "code", label: "代码", icon: Code },
  { value: "link", label: "链接", icon: Link, shortcut: "⌘/Ctrl+K" },
] as const;

/** Organization form composition; authored Markdown remains the sole draft. */
export function OrganizationMarkdownEditor({
  id,
  value,
  onChange,
  disabled = false,
  maxLength = 12000,
  placeholder,
  label = "Markdown 内容",
  dirty = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  label?: string;
  dirty?: boolean;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [formatError, setFormatError] = useState("");

  function applyFormat(format: MarkdownFormat) {
    const input = textarea.current;
    if (!input || disabled) return;
    const change = markdownEdit(input.value, input.selectionStart, input.selectionEnd, format);
    if (input.value.length - (change.to - change.from) + change.text.length > maxLength) {
      setFormatError(`添加格式会超过 ${maxLength} 字符，请先缩短内容。`);
      return;
    }
    input.focus({ preventScroll: true });
    input.setSelectionRange(change.from, change.to);
    // insertText keeps formatting in the browser's native undo history. Assigning
    // value or using setRangeText here discards that editing continuity.
    if (!document.execCommand("insertText", false, change.text)) {
      setFormatError("无法添加格式，请在正文中直接输入 Markdown 标记。");
      return;
    }
    onChange(input.value);
    input.setSelectionRange(change.selectionStart, change.selectionEnd);
    setFormatError("");
  }

  return (
    <div className="min-w-0 rounded-md border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-2 py-2">
        <div
          role="group"
          aria-label={`${label}格式`}
          className="flex flex-wrap items-center gap-0.5"
        >
          {formats.map(({ value: format, label: formatLabel, icon: Icon, ...rest }) => (
            <Tooltip key={format}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={formatLabel}
                  disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormat(format)}
                >
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {formatLabel}
                {"shortcut" in rest ? `（${rest.shortcut}）` : ""}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="flex items-center gap-2 px-1">
          <Switch id={`${id}-preview`} checked={preview} onCheckedChange={setPreview} />
          <Label htmlFor={`${id}-preview`} className="cursor-pointer">
            实时预览
          </Label>
        </div>
      </div>
      <div className={cn("grid min-w-0", preview && "lg:grid-cols-2")}>
        <div className="min-w-0 p-2">
          <Textarea
            ref={textarea}
            id={id}
            aria-label={label}
            aria-describedby={`${id}-help`}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setFormatError("");
            }}
            onKeyDown={(event) => {
              if (
                event.nativeEvent.isComposing ||
                event.altKey ||
                !(event.metaKey || event.ctrlKey)
              )
                return;
              const format = ({ b: "bold", i: "italic", k: "link" } as const)[
                event.key.toLowerCase() as "b" | "i" | "k"
              ];
              if (format) {
                event.preventDefault();
                event.stopPropagation();
                applyFormat(format);
              }
            }}
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
            rows={10}
            className="max-h-[60dvh] min-h-56 resize-y leading-relaxed"
          />
        </div>
        {preview && (
          <section
            aria-label={`${label}预览`}
            className="max-h-[calc(60dvh+1rem)] min-w-0 overflow-auto border-t p-4 lg:border-t-0 lg:border-l"
          >
            <p className="mb-3 text-xs text-muted-foreground">预览{dirty ? " · 未保存" : ""}</p>
            {value.trim() ? (
              <OrganizationMarkdown content={value} />
            ) : (
              <p className="text-sm text-muted-foreground">开始输入后，这里会实时显示排版效果。</p>
            )}
          </section>
        )}
      </div>
      <div
        id={`${id}-help`}
        className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground"
      >
        <span>{formatError || "支持 Markdown，选中文字可设置格式"}</span>
        <span>
          {dirty ? "未保存 · " : ""}
          {value.length} / {maxLength}
        </span>
      </div>
      <span role="status" className="sr-only">
        {formatError}
      </span>
    </div>
  );
}
