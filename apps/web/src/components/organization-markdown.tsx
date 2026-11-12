"use client";

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export function OrganizationMarkdown({
  content,
  components,
}: {
  content: string;
  components?: Components;
}) {
  return (
    <div className="min-w-0 text-sm leading-relaxed break-words [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold [&_hr]:my-4 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, title }) => (
            <a
              href={href}
              title={title}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 max-w-full overflow-x-auto">
              <table className="w-full border-collapse text-left">{children}</table>
            </div>
          ),
          th: ({ children, style }) => (
            <th style={style} className="border bg-muted px-3 py-2 font-medium">
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td style={style} className="border px-3 py-2">
              {children}
            </td>
          ),
          ...components,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
