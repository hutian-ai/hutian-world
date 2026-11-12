# Beautiful UI 来源与适配

本目录直接派生自 [Beautiful UI](https://github.com/slev12397/beautiful-ui/tree/ff0f74d62d8be9d89bcb735b3632e31a6ccf88dc)，
固定 SHA：`ff0f74d62d8be9d89bcb735b3632e31a6ccf88dc`。

使用 shadcn CLI 引入 `https://www.beautifului.dev/r/thinking-state.json` 与
`https://www.beautifului.dev/r/tool-chips.json`；引入时 registry 源码与固定 SHA 下
`components/primitives/ThinkingState.tsx`、`ToolChips.tsx` 逐字一致。

- `thinking-state.tsx` 保留展开入口、图标、纵向 trace 层级，改为接收真实状态、文案与 assistant-ui 分组内容。
- `tool-chips.tsx` 保留图标/动作/内容 chip 行、悬停展开提示与内联详情；用工具调用 ID 区分同名工具，添加真实状态文字。
- 移除演示定时器、模拟步骤/数据、假耗时与无数据的 diff 操作；代码审查继续由现有 CodeChangeSet 工作面承载。
- 上游 token 改用 hutian 语义 token；复用 shadcn/ui 的 Button、Badge、Collapsible 和 assistant-ui 的滚动保护。
  不安装上游 foundation CSS，不改变全局主题；折叠内容由 Radix 管理，支持键盘与 reduced motion。

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
