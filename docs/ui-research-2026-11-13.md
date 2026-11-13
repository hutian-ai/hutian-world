# 核心工作台界面研究

研究日期：2026-11-13。目的是让本周 hutian MVP 可用，保留独立基础设施路线，不 fork 整个竞品，不重新建设组件库。

## 研究和体验范围

本机使用独立 Chrome 配置实际打开各产品可访问页面，读取页面内容并保留截图。浏览器控制服务连续两次超时，改用本机已有 Playwright 驱动 Chrome；没有在仓库新增测试框架或 fixture。

| 参考 | 实际访问 / 阅读 | 能得出的结论 | 不能声称的结果 |
| --- | --- | --- | --- |
| 旧 hutian | 本机 DESIGN.md、沟通目录、创建对话、Runtime 设置、上下文组装源码 | 已有主题、组件与沟通机制可按需恢复 | 本轮未重新运行旧工程全流程 |
| 新 hutian | 实际创建协作群、添加资料与记忆、选择 Runtime、发消息与刷新 | 可直接定位当前入口和接线问题 | 本机可用不等于多人或公网可用 |
| agentes-chat | 公开登录页、README、聊天 schema、执行会话与任务讨论源码 | 频道与 DM 是消息主体，Agent run 和原生 session 分层 | 邮箱登录后的完整任务未体验 |
| Multica | 官网公开交互展示、官方 Chat 文档及 chat 组件目录 | 直接开始对话、运行状态靠近当前工作、设置逐步展开 | 官网展示不等于已验证真实 Agent 执行 |
| Happier | Web 实际首屏、官方 session 文档和组件目录 | 设备、会话、原生执行状态需要明确区分 | 本次首屏仍在加载，没有连接用户设备或运行任务 |
| Cindy | 官网实际访问、README、桌面客户端目录 | 开始工作和设备可用性应降低理解成本 | 官网跳转国内站；没有完成桌面客户端内的任务体验 |
| Open WebUI | 官方 Knowledge 文档；公开 demo 连接失败 | 资料附加、等待处理、回答引用及原文核对值得采用 | 没有把文档阅读表述为完整客户端体验 |

私有原始截图和浏览器记录在根工作区 `.local/ui-research-2026-11-13/`。它们是研究材料，不是可分发的虚假演示数据。

## 新版当前问题与对应修正

1. 只有私聊入口，群聊、频道和执行入口分散。将它们统一为沟通目录，分组保留三种用途。
2. 打开前的大面积空态缺少明确任务起点。显示可用助手和开始对话动作；不放假统计、假在线角色或装饰看板。
3. 消息发送与助手执行没有接通。输入区明确选择只发送或请某位助手回复；一次明确动作才触发宿主，不默认唤醒所有成员。
4. Runtime 的展示连接与旧聊天室执行连接不是同一套。执行必须携带明确的连接选择，原运行仍沿原凭据和回执查询。
5. 资料和记忆只有独立模块，聊天中没有可感知的使用方式。输入区显式选择，宿主按需要检索；展示取得的参考来源，回复可链接回原文。
6. 当前浏览器刷新依赖服务端重新读取。轮询只读取当前房间，避免每次重复读取全部房间目录；未知执行只核对，不自动替代。

## 采用与后置

本周采用旧 hutian 的工作站主题、固定导航、会话目录、对象头及 assistant-ui 输入与 Markdown 展示；参考 Multica 的直接开始和运行反馈，Happier 的原生能力与应用状态分离，Open WebUI 的引用核对。agentes-chat 用于检查聊天、run 和 session 的职责，不复制整套 Engine。

新全局视觉、跨页面组件替换、原生 session 管理、文件树、终端、复杂审批收件箱和任务看板均不在本周首次可用链路中展开。布局与主题继续以 DESIGN.md 为准；更大风格改版先提供具体候选供用户评审。

## 主要来源

- [旧 hutian 沟通目录](../../hutian/apps/web/src/components/communication-thread-list.tsx)
- [旧 hutian Runtime 设置](../../hutian/apps/web/src/components/conversation-runtime-settings.tsx)
- [旧 hutian 上下文输入](../../hutian/apps/core-service/src/modules/communication/conversation-runtime-input.ts)
- [agentes-chat 聊天模型](https://github.com/agentes-chat/agentes-chat/blob/main/packages/db/src/schema/chat.ts)
- [agentes-chat 执行会话](https://github.com/agentes-chat/agentes-chat/blob/main/packages/engine/src/brains/select.ts)
- [Multica Chat 文档](https://multica.ai/docs/chat)
- [Multica Chat 组件](https://github.com/multica-ai/multica/tree/main/packages/views/chat/components)
- [Happier session 文档](https://docs.happier.dev/sessions)
- [Happier session 组件](https://github.com/happier-dev/happier/tree/dev/apps/ui/sources/components/sessions)
- [Cindy README](https://github.com/makecindy/cindy)
- [Cindy 桌面客户端](https://github.com/makecindy/cindy/tree/main/apps/desktop)
- [Open WebUI Knowledge](https://docs.openwebui.com/features/workspace/knowledge/)
- [AnythingLLM raw text 接口](https://github.com/Mintplex-Labs/anything-llm/blob/pg/server/endpoints/api/document/index.js)

上游许可和部署形态分别核对。Multica 当前 README 自称 source-available；Cindy 的公开仓库包含客户端、不包含后端。参考交互不能推导为可以直接复制全部实现或后端已开源。
