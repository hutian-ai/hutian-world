# Beautiful UI Context Cards 来源与适配

本组件直接派生自 [Beautiful UI ContextCards](https://github.com/slev12397/beautiful-ui/blob/c99a3586cf4fc093091feb47d3c066da1fb2e342/components/primitives/ContextCards.tsx)。
固定 SHA：`c99a3586cf4fc093091feb47d3c066da1fb2e342`，于 2026-09-22 核对。

通过项目包管理器依次执行 `pnpm dlx shadcn@latest view`、`add --dry-run` 与 `add --yes`，registry item 为
`https://www.beautifului.dev/r/context-cards.json`。CLI 下载的原始 `ContextCards.tsx` 与固定 SHA 的对应源码逐字一致。
为避免上游 foundation 覆盖项目主题，实际引入先落在临时目录，再将组件源码移入本目录适配。
registry 只声明 foundation 文件依赖，没有新增 npm 依赖；foundation 未引入项目。

- 保留标题栏、真实引用片段与来源操作的卡片层级，用现有 shadcn/ui Card、Badge、Button 和语义 token 适配。
- 移除 `CHUNKS`、固定数量 `32`、700ms 定时器、固定文件类型配色与演示动效。
- 聊天默认以可展开的引用摘要展示实际资料数和片段数；资料数按 `documentId` 去重，仅用于摘要，所有原序号和片段仍逐条保留。
  不从片段数推断模型完整上下文、token 数或实际采用比例。
- 卡片预览使用原 quote，三行裁剪仅作用于展示；原 Sheet 保留完整引用、原始序号与冻结版本的完整资料链接。
  完整资料链接不预取，实际访问继续经过既有 Core 授权页面。
- 展开使用 Radix Collapsible，聊天调用方复用 assistant-ui 滚动保护。来源 Sheet 使用常驻 SheetTrigger，关闭焦点由 Radix 恢复。
- 仅 `KnowledgeCitations` 的 `context-cards` 展示选项使用本组合，其他工作页面仍保留原有引用按钮。

MIT License

Copyright (c) 2026 Shane Levine

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
