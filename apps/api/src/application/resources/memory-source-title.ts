const genericTitles = new Set(["会话工作记录", "保存的工作记录", "工作记忆"]);
const requestLabel = "用户原话（事实来源）：";
const replyLabel = "角色回复（仅为角色陈述，不代表用户确认或执行成功）：";

/** An excerpt of the source request, not an inferred fact or completion claim. */
export function chatMemoryTitle(request: string) {
  const text = request
    .replace(/\[([^\]]+)\]\([^\n)]+\)/g, "$1")
    .replace(/^\s*(?:#{1,6}|>|[-+])\s+/gm, "")
    .replace(/[`*~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const characters = Array.from(text);
  return characters.length > 60
    ? characters.slice(0, 59).join("") + "…"
    : text || "未提供正文的记忆来源";
}

/** Old generic titles are projected for reading; stored source text stays intact. */
export function memorySourceTitle(content = "", storedTitle?: string) {
  if (!content.trim())
    return { title: storedTitle?.trim() || "原文暂不可读取" };
  const heading = content
    .trimStart()
    .match(/^#{1,2}[ \t]+(.+?)(?:[ \t]+#+)?(?:\r?\n|$)/)?.[1]
    .trim();
  const requestStart = content.indexOf(requestLabel);
  const originalTitle =
    storedTitle?.trim() ||
    heading ||
    (requestStart < 0
      ? content
          .split("\n")
          .find((line) => line.trim())
          ?.slice(0, 60)
      : undefined);
  if (originalTitle && !genericTitles.has(originalTitle))
    return { title: originalTitle };

  const replyStart = content.indexOf(
    replyLabel,
    requestStart + requestLabel.length,
  );
  const request =
    requestStart >= 0
      ? content.slice(
          requestStart + requestLabel.length,
          replyStart < 0 ? undefined : replyStart,
        )
      : content.replace(/^\s*#{1,2}[^\n]*(?:\n|$)/, "");
  return {
    title: chatMemoryTitle(request),
    ...(heading && genericTitles.has(heading) ? { sourceTitle: heading } : {}),
  };
}
