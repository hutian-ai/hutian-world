import type { ExecutionActivity } from "@hutian-world/contracts";
import { Terminal } from "lucide-react";
import type { ToolStep } from "@hutian-ai/design/beautiful-ui/tool-chips";
import type { ExecutionProjection } from "@hutian-ai/design/chat/types";
const record = (value: unknown): Record<string, any> =>
  value && typeof value === "object" ? (value as Record<string, any>) : {};
function commandPreview(value: unknown): string {
  const command = commandText(value).replace(/\s+/g, " ").trim();
  const wrapper = command.match(
    /^(?:\S*\/)?(?:bash|zsh|sh|fish|pwsh|powershell|cmd)(?:\.exe)?\s+-(?:[lic]+|command)\s+(.+)$/i,
  );
  const text = wrapper?.[1] ?? command;
  return (
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('"') && text.endsWith('"'))
      ? text.slice(1, -1)
      : text
  ).slice(0, 120);
}
function commandText(value: unknown): string {
  const text = String(value ?? "");
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "string" ? parsed : text;
  } catch {
    return text;
  }
}
// MCP results carry readable text alongside their transport envelope.
function toolOutputText(value: unknown): string {
  if (typeof value === "string") return value;
  const output = record(value);
  const result = record(output.result ?? output);
  if (Array.isArray(result.content))
    return result.content
      .map(record)
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n\n");
  return "";
}
function toolFailureLabel(
  tool: Record<string, unknown>,
  output: string,
): string {
  const error = record(tool.error ?? record(tool.rawOutput).error).message;
  const reason =
    typeof error === "string"
      ? error
      : tool.type === "mcpToolCall"
        ? output.trim().split("\n")[0]
        : "";
  // Translate known Computer Use errors without inferring a successful retry.
  if (tool.server === "cua_repl") {
    if (reason?.startsWith("Invalid app:")) return "未找到应用";
    if (reason?.includes("noWindowsAvailable")) return "未找到可操作窗口";
  }
  return reason ? `执行失败：${reason}` : "执行失败（未记录原因）";
}
export function projectActivity(
  activity: ExecutionActivity,
): ExecutionProjection {
  const blocks: Array<{
    id: string;
    text?: string;
    tool?: ToolStep;
    diff?: string;
    diagnostic?: { label: string; detail: string };
    thinking?: { startedAt?: string; completedAt?: string; summary?: string };
  }> = [];
  const tools = new Map<string, ToolStep>();
  const toolFacts = new Map<string, Record<string, any>>();
  const finals = new Map<string, string>();
  let pendingFinal = "";
  const messages = new Map<string, Array<{ id: string; text?: string }>>();
  let pendingText: { id: string; text?: string; messageId: string } | null =
    null;
  for (const entry of activity.events) {
    const event = record(entry.payload);
    if (entry.type !== "event") continue;
    // Read old receipts as well as the driver's structured status. Native notices have
    // no assistant message identity or phase and must not appear as assistant prose.
    const legacyFallback =
      event.type === "text_delta" &&
      !event.messageId &&
      !event.phase &&
      /^Warning: Falling back from WebSockets to HTTPS transport\./.test(
        String(event.text ?? ""),
      );
    if (
      legacyFallback ||
      (event.type === "status" &&
        ["codex_transport_fallback", "codex_retry"].includes(event.tag))
    ) {
      const label =
        event.tag === "codex_retry"
          ? "执行端正在重试"
          : "WebSocket 连接失败，执行端已切换 HTTPS";
      blocks.push({
        id: `diagnostic:${entry.sequence}`,
        diagnostic: { label, detail: String(event.text ?? "") },
      });
      pendingText = null;
      continue;
    }
    if (event.type === "text_delta" && event.stream !== "thought") {
      if (event.phase === "final_answer" || event.phase === "partial_answer") {
        pendingFinal += String(event.text ?? "");
        continue;
      }
      const messageId: string = String(
        event.messageId ?? pendingText?.messageId ?? `legacy:${entry.sequence}`,
      );
      if (
        !pendingText ||
        pendingText.messageId !== messageId ||
        blocks.at(-1) !== pendingText
      ) {
        pendingText = { id: `text:${entry.sequence}`, messageId, text: "" };
        blocks.push(pendingText);
        const parts = messages.get(messageId) ?? [];
        parts.push(pendingText);
        messages.set(messageId, parts);
      }
      pendingText.text += String(event.text ?? "");
    }
    if (event.type === "message_completed") {
      if (event.phase === "final_answer" || event.phase === "partial_answer") {
        finals.set(
          String(event.messageId ?? entry.sequence),
          String(event.text ?? ""),
        );
        pendingFinal = "";
        continue;
      }
      const messageId: string = String(
        event.messageId ?? pendingText?.messageId ?? `legacy:${entry.sequence}`,
      );
      const parts = messages.get(messageId);
      const text = String(event.text ?? "");
      if (parts?.length) {
        // Preserve text/tool order when one public message spans a tool boundary.
        // Completion corrects only this message, never another in-flight message.
        const prefix = parts
          .slice(0, -1)
          .map((part) => part.text ?? "")
          .join("");
        if (text.startsWith(prefix))
          parts[parts.length - 1].text = text.slice(prefix.length);
        else {
          parts[0].text = text;
          for (const part of parts.slice(1)) part.text = "";
        }
      } else {
        const block = { id: `message:${entry.sequence}`, text };
        messages.set(messageId, [block]);
        blocks.push(block);
      }
      if (pendingText?.messageId === messageId) pendingText = null;
    }
    if (
      event.type === "codex_event" &&
      event.kind === "diff" &&
      typeof event.diff === "string"
    ) {
      const previous = blocks.find((b) => b.id === "native-diff");
      if (previous) previous.diff = event.diff;
      else blocks.push({ id: "native-diff", diff: event.diff });
    }
    const native =
      event.type === "codex_event" && event.kind === "item"
        ? record(event.item)
        : null;
    if (native?.type === "reasoning" && typeof native.id === "string") {
      const id = `thinking:${native.id}`;
      let block = blocks.find((item) => item.id === id);
      if (!block) {
        block = { id, thinking: {} };
        blocks.push(block);
        pendingText = null;
      }
      if (event.stage === "started") block.thinking!.startedAt ??= entry.at;
      if (event.stage === "completed") block.thinking!.completedAt = entry.at;
      if (typeof native.summary === "string" && native.summary.trim())
        block.thinking!.summary = native.summary;
      continue;
    }
    const update = event.type === "tool_call" ? event : native;
    if (update && update.type !== "reasoning") {
      const id = String(update.toolCallId ?? update.id ?? entry.sequence);
      const previous = toolFacts.get(id);
      const tool: Record<string, any> = {
        ...previous,
        ...Object.fromEntries(
          Object.entries(update).filter(([, value]) => value !== undefined),
        ),
        rawInput: { ...record(previous?.rawInput), ...record(update.rawInput) },
      };
      if (
        update.type === "tool_call" &&
        previous?.type &&
        previous.type !== "tool_call"
      )
        tool.type = previous.type;
      if (/^tool call(?:\s|$)/i.test(String(update.title ?? "")))
        tool.title = previous?.title;
      toolFacts.set(id, tool);
      const status = String(
        tool.status ??
          (event.stage === "completed" ? "completed" : "in_progress"),
      );
      const complete = ["completed", "complete", "success"].includes(status);
      const failed = ["failed", "cancelled", "error"].includes(status);
      const input = record(tool.rawInput);
      const args = tool.arguments ?? input.arguments;
      const outputValue =
        tool.aggregatedOutput ?? tool.output ?? tool.rawOutput ?? tool.result;
      const output = toolOutputText(outputValue);
      const failureLabel = failed ? toolFailureLabel(tool, output) : null;
      const error = record(tool.error ?? record(tool.rawOutput).error).message;
      const actionTitle = record(args).title;
      const labels: Record<string, string> = {
        commandExecution: "终端",
        mcpToolCall: "调用工具",
        webSearch: "搜索网页",
        fileChange: "修改文件",
      };
      const title = String(
        labels[tool.type] ??
          (tool.command || input.command
            ? "终端"
            : (tool.title ?? tool.tool ?? tool.name ?? "工具调用")),
      );
      const row: ToolStep = {
        id,
        icon: <Terminal className="size-4" />,
        label: title,
        chip:
          tool.command || input.command
            ? commandPreview(tool.command ?? input.command)
            : commandText(
                typeof actionTitle === "string" && actionTitle.trim()
                  ? actionTitle
                  : [tool.server, tool.tool].filter(Boolean).join("."),
              )
                .replace(/\s+/g, " ")
                .slice(0, 160),
        mono: false,
        status: failed
          ? "failed"
          : complete
            ? "complete"
            : activity.state === "running"
              ? "running"
              : "unconfirmed",
        statusLabel: failed
          ? status === "cancelled"
            ? "已取消"
            : failureLabel!
          : complete
            ? "已完成"
            : activity.state === "running"
              ? "处理中"
              : "结果未记录",
        detail: (
          <>
            {failed && (
              <p className="text-destructive whitespace-pre-wrap">
                {status === "cancelled" ? "工具调用已取消" : failureLabel}
                {typeof error === "string" ? `\n${error}` : ""}
              </p>
            )}
            {args !== undefined && (
              <div>
                <p className="mb-1">
                  {[tool.server, tool.tool].filter(Boolean).join(".")} · 参数
                </p>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono">
                  {typeof args === "string"
                    ? args
                    : JSON.stringify(args, null, 2)}
                </pre>
              </div>
            )}
            {(tool.command || input.command) && (
              <pre className="whitespace-pre-wrap break-all font-mono">
                {commandText(tool.command ?? input.command)}
              </pre>
            )}
            {outputValue !== undefined && outputValue !== null && (
              <div>
                <p className="mb-1">返回内容</p>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono">
                  {output || JSON.stringify(outputValue, null, 2)}
                </pre>
              </div>
            )}
            <details>
              <summary className="cursor-pointer">原始工具记录</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(tool, null, 2)}
              </pre>
            </details>
          </>
        ),
      };
      if (!tools.has(id)) {
        pendingText = null;
        blocks.push({ id: `tool:${id}`, tool: row });
      }
      tools.set(id, row);
    }
  }
  return {
    final: [...finals.values(), pendingFinal].filter(Boolean).join("\n\n"),
    blocks: blocks
      .map((b) => (b.tool ? { ...b, tool: tools.get(b.tool.id)! } : b))
      .filter(
        (b) => b.tool || b.diff || b.diagnostic || b.thinking || b.text?.trim(),
      ),
  };
}
