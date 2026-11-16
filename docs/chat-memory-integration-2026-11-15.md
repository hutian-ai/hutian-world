# 聊天、记忆与知识工具接入

2026-11-15，现有第 7 段的追加修改，保留未提交。目标是让角色在普通聊天中保存和使用信息，沿用 agentes.chat 的工具与上下文组装方式。

后续前后端边界调整已将本页所述工具、资源授权、上下文组装和后台提取统一迁入 `apps/api`；Web 只保留界面与 HTTP 调用。当前运行结构和断开 Web 后的实际检查见[前后端边界交付](backend-boundary-delivery-2026-11-15.md)。下文保留该功能最初接入时的检查记录。

## 已实现链路

- 默认自动检索当前获授权的记忆和知识。旧版默认关闭的本机缓存升级到新的偏好版本；升级后的手动开关继续有效。服务不可用时告知模型缺少来源，保留普通聊天路径。
- `remember / read_memory / update_memory / forget / memory_operation` 接入 Dock 的公开 caller-tools 回调。模型选择值得长期保留的信息，应用决定合法范围、原消息出处和稳定操作编号，Memory Access 及实际 provider 负责推断和持久化。`accepted` 与 `completed` 分开反馈。
- 明确标为 `preference` 的来源登记为自动带入项；每个合法范围最多带入五条、总参考正文最多三万字符。保存操作完成后才读取原文。更正继续使用同一来源编号，另存更正前原文；忘记按后端声明删除，并撤下偏好引用。
- `search_context` 查当前范围；`read_knowledge / save_knowledge / update_knowledge` 读写资料。更新产生新版本，保留旧文件及来源，旧版本退出当前检索候选；导入或索引未知时保持原版本可用。业务页面仍沿用现有资料目录，没有重新设计全局导航和筛选器。
- 短期上下文继续使用 Matrix 最近消息及可用的原生 session。对话达到二十条、且当前摘要覆盖后又积累二十条时，宿主提示 Agent 调用 `save_context_summary`，保存带来源消息编号的目标、决定和未完成事项。下次请求自动带入派生摘要。此实现依靠当前 Agent 调用工具，不是额外独立摘要模型，不能保证每次提示都执行。
- 已确认交付的聊天由现有 DBOS 工作流触发后台提取：没有显式记忆操作时，把用户原话与角色陈述分开提交给支持 `infer` 的原记忆资源；有显式保存、更正或忘记则跳过，避免生成相互矛盾的副本。不支持 `infer` 的 provider 不被冒充为支持提取。后台工作失败保留原聊天，继续观察原操作。

## 范围与执行边界

工具授权由服务端生成，存放在私有 `.local/chat-context/`。执行端只收到工具定义，回调凭据留在宿主。每次调用重新核对空间、用户、资源连接、角色身份及房间参与关系。验证过的二人私聊可用角色私有与本会话资料；群聊只能使用本会话资料。`shared` 只表示当前会话共享，不表示整个工作台。

调用编号和参数指纹保留为回执。同一调用不能替换参数或在结果未知时另造操作重放。明确的资源忙响应可以用原调用编号重试。原生模型、全局权限、配对、执行端私人资产及股票安排未调整。

原生审批请求若准确对应本轮已观察到的 `hutian_context` MCP 调用，并且工具在本轮应用授权目录内，宿主只代答 `allow_once`，记录 `handledBy=caller-tools`。缺少调用标识、工具不匹配、其他 MCP 或原生执行工具，仍走原有人工审批或既有定时任务策略；不修改 allow-always 配置。这样自动保存记忆和摘要不打断普通聊天。

这是一套本机可信工作台接入，不等同于多人公网认证。模型是否把一句话判断为长期偏好是语义决策，不是逐条硬编码的分类器。提取质量、无关命中率和长期上下文质量仍需在日常使用中观察。

## 本次实际检查

- Matrix 宿主 TypeScript 检查、Web 生产构建、脚本语法及差异空白检查通过。
- 真实 Mac 角色通过 Dock 的 MCP 工具调用 `remember`，经原有单次审批后调用 `memory_operation`，观察到 `completed`；之后检索到该来源。没有把 `not_confirmed` 的检索可见性当作完成证据。
- 增补应用工具审批后，再次原生调用记忆工具，观察到单次批准由 `caller-tools` 处理并成功送达；其他原生工具不在这一分支内。
- 同一工具处理链真实检查：无关问题仍自动带入登记偏好；更正原文可读回；忘记后不再带入该来源；合法群聊不能通过 `scope=role` 读取私有来源。
- 真实知识服务保存并更新隔离验收资料，版本增加、旧版本保留、当前候选使用新版本。
- 摘要保存及后续组装检查通过。这不是原生 Agent 必然执行摘要提示的证明。
- 另一轮原生聊天仅回复“收到”、没有工具调用；后台提取操作完成、原文可读、提取结果可检索。
- 所有验收内容明确标为隔离验收资料。失败检查留下的两条临时偏好已删除；聊天原记录、知识版本和必要来源留作核对。私有结果在 `.local/chat-context-acceptance/`。

## 上游依据

固定参考 `desktop-v0.8.8`，不是默认分支未固定版本：

- [记忆工具与运行前召回](https://github.com/agentes-chat/agentes-chat/blob/desktop-v0.8.8/packages/engine/src/context/tools.ts)
- [后台提取](https://github.com/agentes-chat/agentes-chat/blob/desktop-v0.8.8/packages/engine/src/context/reflect.ts)
- [对话摘要](https://github.com/agentes-chat/agentes-chat/blob/desktop-v0.8.8/packages/engine/src/context/summaries.ts)
- [知识页面、版本与对话来源](https://github.com/agentes-chat/agentes-chat/blob/desktop-v0.8.8/docs/adr/0023-wiki.md)

本次复用机制，保留 Matrix、Memory Access、知识服务和 Dock 的原有数据职责；没有复制上游数据库或替换整个应用。
