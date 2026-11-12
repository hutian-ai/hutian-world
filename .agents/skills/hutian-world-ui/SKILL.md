---
name: hutian-world-ui
description: 设计、实现或评审 hutian 的 Web 管理工作站、Timeline、Actor 诊断、工作视图、会话与 Action Center。
---

# hutian 世界 UI

让 Web 成为鲜活 Agent 世界的清晰投影，以及人类真正可用的运营控制台。

## 唯一设计依据

任何 UI 设计、实现或评审开始前，都必须读取仓库根 `DESIGN.md` 的全局原则与本次涉及章节。首次进入跨页面设计、修改全局
组件矩阵/主题/信息架构或更新 `DESIGN.md` 本身时才完整通读。它是 shadcn/ui、Radix UI、assistant-ui、Dice UI、
Shadcnblocks 与 Tailwind CSS 在 hutian 中的唯一项目级实现规范。

- shadcn/ui 与 Radix UI 提供通用 primitive、组件语义、交互行为和可访问性基础；Agent 聊天内容组合优先 Beautiful UI，消息/输入/滚动复用 assistant-ui；
  `DESIGN.md` 在其上固定 hutian 的主题、密度、布局、组件选型、组合与验收要求；
- 外部项目、截图、设计文章和通用 UI Skill 都没有独立设计权，不得与 `DESIGN.md` 混合成第二套风格；
- 全局视觉与交互使用 `DESIGN.md` 固定的 VoltAgent/VoltOps 基线；聊天组合按 Owner 于 2026-09-20 的裁决优先直接采用
  Beautiful UI 源码，assistant-ui 与 shadcn/ui 补足缺项，具体边界以 `DESIGN.md` §6.0.2 为准；
- 若用户要求参考 Empire HQ、Multica 或其他产品，只提取信息架构和交互机制。任何会改变 hutian 视觉、交互或组件选择的
  结论，必须先经 Owner 确认并写入 `DESIGN.md`；
- `DESIGN.md` 没有覆盖所需规则时，不自动套用其他项目或 Skill 的默认审美。探索期可以先做页面局部、可删除的候选验证；
  只有要跨页面复用或正式保留时，才说明缺口并更新 `DESIGN.md`。

## 实现流程

1. 明确页面要回答的问题、当前主体和主要操作，并核对 Docs Hub 中的产品与领域事实。
2. 检查现有产品组合、`apps/web/src/components/ui/` 与 `apps/web/src/components/assistant-ui/`；先按 `DESIGN.md`
   的固定组件矩阵选型；聊天内容组合优先通过 shadcn CLI 检索并引入 Beautiful UI，缺项再用 assistant-ui/shadcn/ui；
   核对源码、依赖、许可与真实事件接入，不能保留演示定时器和模拟数据。只有矩阵未覆盖时才继续检索
   shadcn/ui、assistant-ui、Shadcnblocks 和已批准 registry，禁止在业务页重造已有基础控件。
3. 依据 `DESIGN.md` 明确页面网格、信息密度、标题层级、状态表达、主次操作和移动端重组，再开始编码。
4. World 工作区的信息优先级依次为：人类急需处理的决策、当前 World/Actor 状态、工作与会话上下文、因果 Worldline，
   最后才是深层诊断；平台工程工作区优先呈现异常范围、执行状态、Trace/Log 证据和恢复动作，可以直接使用受控技术语言。
5. 每个展示状态都必须追溯到 API 事实、projection cursor、WorldEvent、Turn、Action、Invocation、交付或审批。客户端 optimistic feedback 只能改善响应速度，绝不能成为第二套业务状态机。
6. 页面布局或关键交互变化时，使用真实浏览器在当前最短路径完成一次 PC smoke，对照 `DESIGN.md` 验证层级、密度、对齐、
   溢出、交互与 console。固定截图、axe 和基于截图的修正只在视觉专项或里程碑稳定化时要求；纯文案、数据映射或无布局影响
   的局部修改不强制启动浏览器。手机或窄屏真实浏览器只在 Owner 明确要求或本次改动专门涉及窄屏交互时追加。

明确呈现加载中、空数据、已过期、已断开、等待中、已阻塞、已拒绝和结果未知状态。仅仅使用了 shadcn/ui 或
assistant-ui 组件、通过构建或看起来“统一”，都不能代替视觉与交互验收。

v1 不增加地图、坐标、Canvas/WebGL、HUD、声音、手柄交互或复杂游戏手感效果；这些属于未来基于同一套 World API 构建的客户端。

本 Skill 用于指导 hutian Web 开发，不是世界内 Actor Skill。
