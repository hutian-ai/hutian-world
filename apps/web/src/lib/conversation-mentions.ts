import {
  unstable_defaultDirectiveFormatter as base,
  type Unstable_DirectiveFormatter,
} from "@assistant-ui/react";

// Keep stable member IDs in the composer's existing text storage. The submitted
// Matrix body is human readable; addressing is separate, verified metadata.
const protectedText =
  /```[\s\S]*?(?:```|$)|`[^`\n]*`|https?:\/\/\S+|\[[^\]\n]*\]\([^\n)]*\)/gu;
export const memberMentionFormatter: Unstable_DirectiveFormatter = {
  serialize: (item) => base.serialize(item),
  parse(text) {
    const result: Array<
      ReturnType<Unstable_DirectiveFormatter["parse"]>[number]
    > = [];
    const parse = (part: string) =>
      result.push(
        ...base
          .parse(part)
          .map((segment) =>
            segment.kind === "mention" && segment.type !== "member"
              ? { kind: "text" as const, text: base.serialize({ ...segment }) }
              : segment,
          ),
      );
    let end = 0;
    for (const match of text.matchAll(protectedText)) {
      parse(text.slice(end, match.index));
      result.push({ kind: "text", text: match[0] });
      end = match.index + match[0].length;
    }
    parse(text.slice(end));
    return result;
  },
};
export function memberMentionMatcher(
  text: string,
  char: string,
  cursor: number,
) {
  const prefix = text.slice(0, cursor),
    offset = prefix.lastIndexOf(char);
  if (offset < 0 || /\s/u.test(prefix.slice(offset + char.length))) return null;
  if (offset && /[A-Za-z0-9_.+-]/u.test(prefix[offset - 1]!)) return null;
  if (
    (prefix.match(/`/g)?.length ?? 0) % 2 ||
    prefix.lastIndexOf("](") > prefix.lastIndexOf(")") ||
    /^\s*>/.test(prefix.split("\n").at(-1) ?? "")
  )
    return null;
  return {
    query: prefix.slice(offset + char.length),
    offset,
    endOffset: cursor,
  };
}
export function composerMessage(raw: string) {
  const segments = memberMentionFormatter.parse(raw);
  return {
    text: segments
      .map((s) => (s.kind === "text" ? s.text : `@${s.label}`))
      .join(""),
    ids: [
      ...new Set(segments.flatMap((s) => (s.kind === "mention" ? [s.id] : []))),
    ],
  };
}

export type MessageMention = { id: string; name: string };
type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
};

/** Render only persisted m.mentions identities; this never addresses a request. */
export function messageMentionPlugin(members: readonly MessageMention[]) {
  const labels = members
    .flatMap((member) => {
      const duplicate = members.some(
        (other) => other.id !== member.id && other.name === member.name,
      );
      return [
        { ...member, label: `${member.name}（${member.id.slice(-6)}）` },
        ...(!duplicate ? [{ ...member, label: member.name }] : []),
      ];
    })
    .sort((a, b) => b.label.length - a.label.length);
  return () => (tree: MarkdownNode) => {
    const visit = (parent: MarkdownNode) => {
      if (
        !parent.children ||
        ["code", "inlineCode", "link", "linkReference", "html"].includes(
          parent.type,
        )
      )
        return;
      parent.children = parent.children.flatMap((child): MarkdownNode[] => {
        if (child.type !== "text" || !child.value) {
          visit(child);
          return [child];
        }
        const text = child.value;
        const parts: MarkdownNode[] = [];
        let start = 0;
        for (let i = 0; i < text.length; i++) {
          if (
            text[i] !== "@" ||
            (i > 0 && /[\p{L}\p{N}_.+-]/u.test(text[i - 1]!))
          )
            continue;
          const member = labels.find(
            (item) =>
              text.startsWith(`@${item.label}`, i) &&
              !/[\p{L}\p{N}_]/u.test(text[i + 1 + item.label.length] ?? ""),
          );
          if (!member) continue;
          if (i > start)
            parts.push({ type: "text", value: text.slice(start, i) });
          const label: MarkdownNode & { data: unknown } = {
            type: "text",
            value: `@${member.label}`,
            data: {
              hName: "span",
              hProperties: {
                "data-member-id": member.id,
                "data-member-label": member.label,
              },
            },
          };
          parts.push(label);
          i += member.label.length;
          start = i + 1;
        }
        if (!start) return [child];
        if (start < text.length)
          parts.push({ type: "text", value: text.slice(start) });
        return parts;
      });
    };
    visit(tree);
  };
}
