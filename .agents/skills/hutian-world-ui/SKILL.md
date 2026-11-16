---
name: hutian-world-ui
description: 实现或评审 Hutian 产品页面与独立设计系统的接入。
---

# Hutian UI 接入

先读仓库 DESIGN.md，按任务只打开相关工作面。通用 UI、主题、Chat 组件已独立到相邻 hutian-design；该项目 AGENTS.md 与 DESIGN.md 的索引负责路由通用组件修改。

- 页面导航、成员配置、数据范围和业务动作留在 Web；消息与执行事实分别属于 Matrix 和 Dock，授权与后台协调属于 API。
- 通用控件使用 @hutian-ai/design/ui/*；聊天使用 assistant-ui/*、beautiful-ui/*、chat/*。不得在 Web 重建本地副本，也不要使用 shadcn CLI 向本应用写入共享组件。
- 聊天业务事件映射位于 chat-execution-projection.tsx；chat-execution.tsx 是接口与授权资源 adapter。设计项目不得反向导入业务 contracts 或源码。
- 主题沿用原 DESIGN 基线，Codex 为聊天主要交互参考，其他产品仅补充已批准机制；不因分离改主题或扩大产品范围。
- 先确认页面主体、完整路径、权威状态和动作，再组合现有组件。无数据时明确加载、空态、错误、离线和结果未知，不补造统计、事件或成功。
- 必要 typecheck/build；布局、交互或跨包运行边界变化时在真实浏览器走一次桌面最短路径，检查主要动作、console 和页面溢出。展示页通过不替代真实后端链路验收。
- 用户未要求不新增测试、fixture 或 CI；当前未提交改动保留，不默认推送发布。
