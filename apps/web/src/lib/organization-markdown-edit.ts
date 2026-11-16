export type MarkdownFormat =
  "heading" | "bold" | "italic" | "list" | "quote" | "code" | "link";

export function markdownEdit(
  value: string,
  start: number,
  end: number,
  format: MarkdownFormat,
) {
  const selected = value.slice(start, end);
  const edit = (
    from: number,
    to: number,
    text: string,
    selectionStart: number,
    selectionEnd: number,
  ) => ({
    from,
    to,
    text,
    selectionStart,
    selectionEnd,
  });

  if (format === "heading" || format === "list" || format === "quote") {
    const from = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
    const last = end > start && value[end - 1] === "\n" ? end - 1 : end;
    const next = value.indexOf("\n", last);
    const to = next < 0 ? value.length : next;
    const prefix =
      format === "heading" ? "## " : format === "list" ? "- " : "> ";
    const lines = value.slice(from, to).split("\n");
    const remove = lines.every((line) => line.startsWith(prefix));
    const text = lines
      .map((line) => {
        if (remove) return line.slice(prefix.length);
        if (line.startsWith(prefix)) return line;
        return (
          prefix + (format === "heading" ? line.replace(/^#{1,6} /, "") : line)
        );
      })
      .join("\n");
    return edit(from, to, text, from, from + text.length);
  }

  if (format === "link") {
    const label = selected || "链接文字";
    const text = `[${label}](https://)`;
    const selectionStart = selected ? start + label.length + 3 : start + 1;
    return edit(
      start,
      end,
      text,
      selectionStart,
      selectionStart + (selected ? 8 : label.length),
    );
  }

  if (format === "code") {
    const wrapped =
      selected.match(/^(`{3,})\n([\s\S]*?)\n\1$/) ||
      selected.match(/^(`+)([^\n]*?)\1$/);
    if (wrapped)
      return edit(start, end, wrapped[2]!, start, start + wrapped[2]!.length);
    const before = value.slice(0, start);
    const after = value.slice(end);
    const openingFence = before.match(/(`{3,})\n$/)?.[1];
    if (openingFence && after.startsWith(`\n${openingFence}`)) {
      const from = start - openingFence.length - 1;
      return edit(
        from,
        end + openingFence.length + 1,
        selected,
        from,
        from + selected.length,
      );
    }
    const openingInline = before.match(/(`+)$/)?.[1];
    if (openingInline && after.startsWith(openingInline)) {
      const from = start - openingInline.length;
      return edit(
        from,
        end + openingInline.length,
        selected,
        from,
        from + selected.length,
      );
    }
    const longest = Math.max(
      0,
      ...Array.from(selected.matchAll(/`+/g), (match) => match[0].length),
    );
    const marker = "`".repeat(
      Math.max(selected.includes("\n") ? 3 : 1, longest + 1),
    );
    const prefix = selected.includes("\n") ? marker + "\n" : marker;
    const suffix = selected.includes("\n") ? "\n" + marker : marker;
    return edit(
      start,
      end,
      prefix + selected + suffix,
      start + prefix.length,
      start + prefix.length + selected.length,
    );
  }

  const marker = format === "bold" ? "**" : "_";
  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= marker.length * 2
  ) {
    const text = selected.slice(marker.length, -marker.length);
    return edit(start, end, text, start, start + text.length);
  }
  if (
    value.slice(start - marker.length, start) === marker &&
    value.slice(end, end + marker.length) === marker
  ) {
    return edit(
      start - marker.length,
      end + marker.length,
      selected,
      start - marker.length,
      end - marker.length,
    );
  }
  const text = marker + selected + marker;
  return edit(
    start,
    end,
    text,
    start + marker.length,
    start + marker.length + selected.length,
  );
}
