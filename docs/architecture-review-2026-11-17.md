**Hutian 技术架构与抽象评审 · 2026-11-17**

本次结论：现有产品和独立模块的总体职责划分应保留，但 World 内部仍处于迁移后的混合结构。需要建立真正共用的应用用例、明确状态与副作用边界，并让契约、错误、授权、数据访问和部署规范成为可检查的规则。仅统一 HTTP 返回外形、把大文件拆小或再加一层网关，都不足以解决当前问题。

这是改造前的评审快照；用户随后已授权实施，现状见 [架构规范](architecture.md) 与 [交付记录](architecture-delivery-2026-11-17.md)。以下保留评审当时的事实：尚未实施架构改造。读取的是当前工作树，包括已有未提交改动；World HEAD 为 `82b7d05`。本次只新增本评审文件，没有修改业务代码、提交、重启服务、迁移数据或调用模型。建议中的治理批次不表示自动进入新的产品阶段。

**范围与证据**

重点读取 World 的 HTTP 入口、应用调用链、权限、数据库、聊天与定时协调、资源工具、Web 状态与发布脚本；检查 Matrix 可选执行宿主、Dock 协议边界、Memory/Knowledge 网关及 SDK、Design 的消费边界。独立模块为定向接口与生命周期检查，并非其全部源码的逐行审计。

证据分为当前源码、只读运行检查和隔离验证。当前 `services:status` 中 Web/API/chat-host 三服务均运行且探针通过；API 探针只检查数据库，不代表所有业务和外部模块健康。另在独立进程中注入内部错误哨兵，验证 command 返回会传播其文本；未访问数据库或写入业务数据。没有重跑聊天、定时工作、跨设备执行、故障注入或负载测试；此前交付记录仅作为历史证据。

评审读取时：API 103 个 TypeScript 文件、8,281 行，其中 workbench 4,678 行，约 56%；Web 93 个源码文件、12,215 行，`communications.tsx` 为 2,179 行；contracts 的 `workbench.ts` 为 865 行。行数仅用于定位职责集中处，不作为质量评分。相对静态 import 图未发现循环；后文指出的是全局回调形成的运行时调用回环，不能称为静态循环依赖。Design 源码中未发现 `@hutian-world/*` 导入。

**总体架构判断**

| 领域 | 当前判断 | 应保留或修正的方向 |
| --- | --- | --- |
| Web / Server | 纯前端边界已落地 | 保留 React/Vite 静态 Web，API 是唯一业务服务器 |
| 模块职责 | 总体合理 | World 管业务与授权，Matrix 管通信，Dock 管原生执行，资源模块管各自领域 |
| 后端分层 | 不完整 | 常规 Nest 模块与迁移来的函数服务、伪 HTTP 分派并存 |
| 应用用例 | 存在入口差异 | 页面命令、REST、后台应调用同一业务规则 |
| HTTP / 类型契约 | 不统一且约束不足 | 统一 World 对外契约，保留独立协议的语义 |
| 数据与事务 | 有良好基础，出现规范回退 | 保留事务、锁、快照、显式迁移，补通知实体与数据访问边界 |
| 工作流与状态 | 持久化已接入，生命周期耦合 | 区分执行、交付、提取、通知及观察失败 |
| 授权 | 单人本机约束明确，按次授权缺收尾 | 保留服务端授权，补工具 grant 生命周期 |
| 资源抽象 | 独立协议和宿主接入已分开 | 保留模块 SDK，避免 World 再实现后端适配 |
| 前端结构 | 共享 UI 已拆，业务状态仍集中 | 拆业务控制器与查询状态，不继续扩大 Design 职责 |
| 查询与实时链路 | 小规模可用，存在放大与截断 | 统一分页、减少重复全量查询、共享会话观察 |
| 诊断与运维 | 可运行，诊断和可复现交付不足 | 结构化脱敏日志、版本清单、完整恢复边界 |

当前建议的形态是“模块化单体 World + 已有独立能力服务”。无须为了治理新增微服务、消息中间件、第二个调度引擎、通用插件市场或自建全套 DDD 框架。成员、Runtime、授权及数据归属的已确认产品决定继续有效。

**需要优先处理的具体问题**

以下 P1 表示下一轮应先解决的可靠性、安全边界或核心结构问题；P2 表示紧随其后的规范与维护问题；不表示已观察到线上事故。每项明确区分源码事实与推导风险。

**1. P1：业务用例没有成为各入口共用的唯一规则。**

`WorkbenchApplication` 构造时注册进程全局 `invoke`；各函数调用 `api("/v1/...", method, body)`，再解析 URL 分派回 Nest Service。正式 Controller 也维护同一套调用和输入解析。这是迁移兼容层，尚未成为清晰的应用层。

具体规则差异：`saveRoleRuntime` 会读取设备、检查 Harness 可用性、验证模型和推理选项；直接 `PUT /v1/roles/:id/runtime` 则进入 `RolesService.setRoleRuntime`，仅执行结构、归属、版本和持久化检查，没有复用前述语义验证。当前用户是本机 owner，这不是跨用户越权证明，但两个正式入口可以接受不同语义的配置。

建议让 `SetMemberRuntime` 一类用例拥有这些规则；Controller、命令适配器和后台直接注入并调用它。内部函数使用显式参数和类型，不再借 URL 表达函数调用。纯映射和算法可以继续是普通函数，不必全部改成类。

证据：`apps/api/src/modules/workbench/application.service.ts:36`；`modules/workbench/services/api.ts:8`；`modules/workbench/services/role-runtime-actions.ts:12`；`modules/roles/roles.controller.ts:40`；`modules/roles/roles.service.ts:87`（后四个路径均相对 `apps/api/src/`）。

验收：从成员页面、正式 HTTP 和内部调用提交同一配置，得到相同的语义校验、权限判断和并发冲突结果。每个迁移完的用例仅有一个业务实现。

**2. P1：已交付回复与记忆提取被放在同一完成路径。**

`chat-dispatch.ts` 已读到 `replyEventId` 后，先 `await reflectChat()`，然后才返回 `replied`。提取过程中会读取授权、会话、记忆能力并写资源；任一步失败都会阻止本次完成更新。外层再把异常改写成“继续观察”。

由此可推导：回答实际上已经进入 Matrix，但 World 的聊天请求记录可能继续保持非完成状态。不是所有页面必然显示处理中，因为部分页面也直接读取宿主结果；本次没有用真实故障复现 UI。

建议先登记权威交付，再以原请求/回复标识记录独立的记忆提取意图；使用现有 DBOS 与业务持久记录完成提取及重试。提取失败影响提取状态，不能否定已交付答案；也不能仅改成无持久记录的 fire-and-forget。

证据：`apps/api/src/modules/workbench/services/chat-dispatch.ts:67`；`apps/api/src/modules/workbench/services/chat-context-tools.ts:462`。

验收：记忆服务不可用时，原聊天仍能登记交付；恢复后只处理同一提取意图，不重发聊天或重复提交已确认的写入。

**3. P1：工具 grant 缺少按次授权的结束机制。**

工具 token 使用随机值，磁盘只以摘要命名，权限文件也有限制；每次调用会复核用户、空间、连接、成员身份和可访问范围，这些措施应保留。但 grant 没有到期时间、运行结束状态或撤销字段，`contextGrant()` 也不核对原运行是否仍允许工具调用。

因此当前更接近“持有 token 且成员范围仍有效即可继续调用”，而非严格的“本次工作期间可调用”。这并不证明 token 已泄露；它是源码可见的授权生命周期缺口。

建议绑定稳定请求身份，派发后关联 runId；区分排队、运行中、结束后的权限。原生执行结束后停用其工具能力，后台提取使用独立的受限服务授权。增加过期/撤销与保留策略，不能依靠随意删除文件解决历史审计和续查。

证据：`apps/api/src/modules/workbench/services/chat-context-tools.ts:29`、`:103`、`:270`；`apps/api/src/modules/workbench/http/context-tools.ts`。

验收：活动运行拥有既定范围；完成、取消或撤销后的原 token 不能继续新增写入；后台提取仍按独立授权执行，历史来源可读。

**4. P1：状态、重试和“结果未知”缺少统一的语义分层。**

聊天和定时工作分别维护字符串状态集合与映射；普通聊天中 blocked 会终止该协调流程，定时工作中 blocked 属于 active，会继续观察并阻止后续重叠执行。两种语义可以有意不同，但现在没有集中定义原因、恢复条件和观察策略。

聊天 processor 捕获大部分协调异常并返回 false，外层每 5 秒继续；定时协调采用类似的 15 秒循环。对于已经被内部 catch 转成正常返回的失败，DBOS step 的 maxAttempts 不会成为重试总上限。不能把“设置了 5 次重试”理解为故障最多尝试 5 次。[DBOS Steps 文档](https://docs.dbos.dev/typescript/tutorials/step-tutorial)说明重试针对抛出的异常。

建议区分：业务请求状态、原生执行观察、回复交付、后处理，以及通知的已读/已处理。明确哪些是终态，哪些是可恢复阻塞；未知结果保留原 ID，不自动重跑。暂时故障采用有边界的退避和重新观察；协议错误、配置错误与程序缺陷进入可诊断的人工处理状态。停止观察也不能伪造执行失败或成功。

证据：`apps/api/src/modules/chat-requests/chat-requests.service.ts:124`；`chat-request.workflow.ts:11`；`apps/api/src/modules/schedules/schedules.runner.ts`；`schedule.workflow.ts:19`。

验收：对重复回执、取消、权限等待、明确失败、连接暂断、结果未知分别说明状态与下一步动作；任何路径都不更换原运行标识或无证据重派发。

**5. P1：错误抽象既丢语义，也存在绕过脱敏的路径。**

全局过滤器仅输出 message，内部 `api()` 又把所有 Error 改成仅含 message 的 ApiError；action catch 将其作为正常返回值 `{ error }` 交给浏览器。HTTP 状态、错误类型、来源、可重试性和 cause 在这条链中丢失，全局过滤器不再参与正常返回值。

本次在独立进程中让内部调用抛出 `INTERNAL_DETAIL_SENTINEL`，`saveRole()` 实际返回 `{ error: "INTERNAL_DETAIL_SENTINEL" }`。这证明内部错误文本可穿透；没有使用真实 SQL 或凭据证明实际泄漏，也不应描述成已发生泄漏事故。

建议定义稳定业务错误类型：code、可公开文案、HTTP 映射、重试/重新观察策略、服务端 cause。外部模块错误在各 adapter 归一化，传输层统一序列化，前端保留结构化错误。生产日志脱敏保留关联信息，不打印原始请求、SQL 参数和授权 token。

普通 JSON 的 `{ code, msg, data }` 可以采用；它只统一传输层。业务拒绝、执行结果未知和资源后处理失败仍需明确模型，不应再把 `{ ok:false }` 包进 `{ code:0, data:... }`。SSE、文件下载、MCP 以及独立模块的领域协议各按其契约处理。机器应依据稳定字段而非解析文案，这也与 [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) 的错误信息设计原则相符；本评审不要求同时引入两套错误格式。

证据：`apps/api/src/common/filters/public-error.filter.ts`；`apps/api/src/modules/workbench/services/api.ts:22`；`services/actions.ts:20`；`apps/web/src/lib/api.ts:42`。

验收：同一错误从不同入口得到一致分类；内部哨兵、原始 SQL 和配置详情不返回客户端；日志可凭 requestId 查到脱敏原因。

**6. P2：HTTP 契约暴露实现形状，类型共享不等于契约完备。**

命令白名单和 `satisfies WorkbenchCommands` 有价值，但公开操作名称直接沿用 `communication-actions.askConversation` 等文件/函数名称。许多输入是 unknown，资源输出含 any，部分协议靠返回值断言；大块活动结构在 contracts 中重复展开。后端有不少 Zod 解析，并非完全没有运行时校验。

建议按领域定义输入 schema、响应 schema 和稳定操作名，复用基础结构；持久请求快照与浏览器视图分开，快照增加明确版本。不要把内部 Entity、原生 SDK 对象或执行凭据直接当公共 DTO。REST 与显式类型化命令可以共存，但应共享用例与错误边界。没有必要为了“统一”强行将所有动作改成 CRUD。

同时规范分页游标、排序稳定性、时间/时区、空值、乐观锁、幂等键、附件大小和取消信号。当前已有安排 revision、运行快照、Matrix transactionId、工具回执；应推广其适用规则，而不是宣称系统没有幂等保护。

证据：`packages/contracts/src/workbench.ts:239`、`:459`；`packages/contracts/src/chat.ts:63`；`apps/api/src/modules/workbench/commands.ts`；`apps/web/src/lib/api.ts:50`。

**7. P2：数据库规范出现回退，持久化归属还需操作层面的定义。**

API README 要求普通业务不直接 db.query，但 `schedules.service.ts:428` 起的通知逻辑包含 7 处直接 SQL 调用，包括普通列表和单条查询；通知表有 migration，却没有相应通知 EntitySchema。复杂条件更新/原子 CTE 可以保留 SQL，问题是规则例外没有收口，普通业务也旁路了既有约定。

角色和安排已有事务、乐观并发、行锁、唯一约束和明确范围过滤；这些是正确基础。建议通知读写进入所属 repository/query service，常规操作使用 ORM，复杂 SQL 封装为具名原子操作并显式传入权限范围与事务上下文。不要为了消除 SQL 而拆开原本原子的更新。

World 的 PostgreSQL 之外，还存在工具 grant/回执/摘要文件、宿主队列与 Dock 回执、资源凭据与原文、Memory SQLite 操作记录。多种存储并非错误，但应列明权威数据、可重建投影和缓存，以及原子写、并发、保留、备份和恢复策略。凭据不因“统一存储”就变成普通业务明文列。

证据：`apps/api/README.md` 数据访问约定；`apps/api/src/modules/schedules/schedules.service.ts:428`；`apps/api/src/infrastructure/database/migrations/schedule-inbox.ts`；`modules/workbench/services/chat-context-tools.ts`；`../memory-access/hutian_memory_access/protocol.py`。

**8. P2：前端抽象完成了视觉拆分，尚未完成业务状态拆分。**

Design 的单向依赖正确。World 的 `communications.tsx` 同时处理实时订阅、历史合并、发送、上传、排队、停止、交接、资源保存、草稿及渲染；修改一项能力仍需要读取大量无关上下文。路由还保留迁移式 async page 返回 ReactNode 的适配，全局 `hutian:refresh` 触发路由重新验证。

建议按真实职责提取会话数据/订阅、Composer 控制、运行控制、交接与成果保存；组件负责组合与呈现。服务端状态、URL 状态和本地交互状态分别管理。先复用 React Router 和现有状态机制，只有具体缺口再决定是否引入查询库。业务 hooks 留在 World，Design 继续接收中立数据与回调。

证据：`apps/web/src/components/communications.tsx:1044`、`:1179`；`apps/web/src/main.tsx:74`、`:104`；`../hutian-design/AGENTS.md`。

验收：切换会话不串状态，旧请求不覆盖新会话，重连不重发消息，历史分页保留位置；共享 UI 文档站继续独立工作。拆文件本身不算验收完成。

**9. P2：实时观察有重复查询放大，部分列表是截断而非完整分页。**

每个 SSE 连接每轮读取一次会话，随后等待 1 秒；`readConversation()` 又聚合宿主状态、工作台总览、聊天请求和设备名称。多个标签页分别承担这些查询。记忆列表进一步为最多 100 条来源逐条读取详情。源码能确认查询放大方式，尚未通过压测证明实际瓶颈或响应时间。

安排、运行、通知及资源列表存在 100/50 条上限，部分没有下一页游标；聊天历史的分页已经接入，不能把两者混为一谈。

建议集中每个授权范围内的会话观察并复用结果，区分配置变化与活动增量；保留权威快照用于重连核对。为慢调用传播 AbortSignal，设置并发上限和负载边界。列表明确返回 cursor/hasMore；资源目录返回摘要字段，避免为了列表标题并发读取所有原文。当前单进程即可完成，不必新增外部消息总线。

证据：`apps/api/src/modules/workbench/http/chat-events.ts:83`；`services/communications.ts:260`；`services/resources.ts:70`；`apps/api/src/modules/schedules/schedules.service.ts:92`、`:468`；`docs/chat-history-pagination-2026-11-17.md`。

**10. P2：独立模块边界值得保留，但宿主发布单元仍依赖 examples。**

Memory/Knowledge 拥有自己的领域 SDK、权限和后端适配，World 的 resource plugin 只做连接与调用，拆分方向合理。Knowledge 保留不可变原文、版本及 unknown，Memory 持久记录操作；不应为了统一 World 的响应外形而破坏这些独立契约。

Matrix SDK 本身保持通信职责，但 World 常驻运行入口直接启动 `matrix-team-chat/examples/web/server.ts`，实际依赖的队列、执行桥、活动与成果代码也在 examples，HTTP 路径由 World 手写。软件包发布内容主要是 dist SDK，执行宿主并未形成同等清晰的受支持发布契约。

建议在 Matrix 仓内把可选宿主明确为受支持的应用/入口，定义版本化客户端和兼容范围，保留其独立进程、原 Dock 身份及回执。不是把它搬入 World，也不需要马上再建仓库。

证据：`scripts/local-services.mjs:21`；`apps/api/src/modules/workbench/services/communications.ts:175`；`../matrix-team-chat/package.json`；`../matrix-team-chat/examples/host-worker.ts`；`apps/api/src/modules/resource-plugins/registry.ts`。

**11. P2：缺少贯穿调用链的可观测性及兼容升级规则。**

API 全局错误日志基本只有固定文本，很多 catch 只留下用户提示。现在遇到失败，常要跨 World、Matrix、Dock 和私有文件手工找关联；已有业务 ID 不等于每一层日志都记录了它们。

建议最小结构化日志携带 requestId、workflowId、roomId/eventId、runId 和模块错误码，按需关联而非复制完整内容；区分等待用户、原生执行、交付、后处理和依赖不可用。健康端点区分进程存活、核心就绪及可选模块降级，不能要求可选记忆服务故障导致整个工作台被判死。

DBOS 当前固定 `applicationVersion: "chat-v1"`。固定版本本身并非错误，但后续改变持久工作流步骤时必须有兼容策略；旧检查点不能自动适配任意新步骤顺序。应记录步骤/快照变更，采用兼容补丁、明确版本或旧流程排空方案，保留原 workflow ID。[DBOS 工作流升级文档](https://docs.dbos.dev/typescript/tutorials/upgrading-workflows)对此有明确边界。本评审不建议直接修改当前版本号或启用未经验证的升级能力。

独立仓库的 `link:` 依赖和源码宿主还需要一个可复现的组合版本清单。当前本地开发方式合理，但仅固定 World lockfile 不能固定相邻仓库内容。Web 原子更新与旧资源保留已经有实现，应保留；还需定义 API、数据库迁移、宿主与 SDK 的兼容组合及恢复顺序。

证据：`apps/api/src/common/filters/public-error.filter.ts:19`；`apps/api/src/modules/health/health.controller.ts`；`apps/api/src/infrastructure/workflows/workflows.module.ts:15`；`package.json`；`apps/api/package.json`；`apps/web/package.json`；`scripts/local-services.mjs`。

**建议采用的内部结构**

| 层次 | 负责 | 不应承担 |
| --- | --- | --- |
| HTTP / SSE / 工具入口 | 身份进入、输入校验、调用用例、传输映射 | 独立的一套业务规则 |
| 领域应用用例 | 成员配置、聊天提交、交接、安排、资源授权、成果保存 | URL 分派、进程全局回调 |
| 领域策略与状态转换 | 配置生效、权限范围、幂等与并发语义、合法状态变化 | HTTP 和供应商方言 |
| Repository / 外部 adapter | 事务与条件写、Matrix/Dock/资源 SDK 调用、错误映射 | 决定产品授权或伪造执行成功 |
| DBOS / 后台协调 | 持久意图、步骤恢复、观察与后处理 | 替代 Dock 原生执行事实 |
| Web 业务状态与呈现 | 查询、订阅、交互、业务事件投影 | 服务端授权和凭据管理 |
| Design | 可复用主题、组件、消息与执行呈现 | World 业务契约与生命周期 |

上述是职责关系，不要求每层建仓库，也不要求每个函数套多层接口。优先在现有模块中形成少量明确的 Provider 与策略函数。Nest 的模块 exports/imports 可承担依赖边界，无须额外实现服务定位器。[Nest Modules 文档](https://docs.nestjs.com/modules)

**收敛顺序与交付边界**

| 建议批次 | 可独立交付的成果 | 必要验收 |
| --- | --- | --- |
| A：先修生命周期 | 回复交付与记忆提取分离；工具 grant 结束；异常分类与脱敏 | 记忆不可用仍交付、过期授权拒绝、内部错误不外泄 |
| B：统一应用入口 | 先用成员 Runtime 配置贯通 Controller/命令/应用服务，移除该路径伪 HTTP 调用，再迁移聊天与安排 | 同一用例各入口规则一致；历史和排队快照不变 |
| C：契约与数据边界 | 响应/错误/分页/幂等规范；通知数据访问归位；模块 adapter 错误统一 | 浏览器、后台、服务调用各走完整路径；保留原子条件写 |
| D：前端与运行交付 | 会话业务状态拆分、共享观察、诊断关联、组合版本及恢复清单 | 切换/重连/分页、旧标签页更新、同版本恢复核对 |

各批次按实际小成果推进，不能把这一整份清单当成一次大重写。现有单人模式、人工选择与交接、项目管理后置、自主编排后置、原生模型/权限归属均不扩大。并行多 worker、多用户公网和高可用在相应产品阶段再引入。

**规范如何避免再次退回**

形成一份现行架构索引，集中记录依赖方向、数据归属、契约、错误、工作流和持久化例外；历史交付文档保留事实，但不继续充当互相覆盖的当前规范。每个新功能按“入口 → 用例 → 授权/事务 → 外部效果 → 状态 → 用户可见结果”评审。

在已有 TypeScript/ESLint 检查中逐步限制新代码的禁用依赖和临时兼容调用，显式列出待迁移例外；不新增测试框架、测试矩阵或沉重 CI。新增公开契约必须有 schema、错误语义和兼容说明；新增持久状态必须说明恢复与清理；新增异步副作用必须说明原 ID、重复观察和失败后的去向。实际验收仍采用必要编译和最短真实使用路径，不能以目录调整或文档完成代替端到端可用。
