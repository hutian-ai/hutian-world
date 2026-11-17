# Hutian 技术架构

本文件描述现行工程边界。产品范围仍以工作区的 `docs/hutian-product-design.md`、`docs/hutian-system-design.md` 为准。用户已授权在功能保持不变的条件下重整实现，并于 2026-11-17 确认本地提交；没有推送或发布。

## 运行单元与数据归属

Hutian World 是模块化单体：React/Vite 静态 Web 与 Nest/Fastify API 分开运行，API 本身就是 Hutian Server。浏览器只持有 HttpOnly/SameSite 会话。后台协调、资源授权、工具实现及模块凭据均在 API；后台直接调用应用用例。

| 单元 | 权威数据及职责 |
| --- | --- |
| World / PostgreSQL | 成员、项目关系、空间授权、安排、冻结请求与运行关联、通知及后处理意图 |
| DBOS | 持久协调步骤、时钟及重试；与业务表使用同一数据库、不同 schema |
| Matrix / 可选 host | 消息、房间、通信身份；host 持有执行连接、队列、回执和文件回流 |
| Dock / 原生 Harness | 原生执行、会话、审批、设备与原生模型能力 |
| Memory Access / Knowledge Gateway | 各自的原文、操作、索引及后端适配 |
| Hutian Design | 主题、基础 UI、Chat 呈现；不依赖 World 业务契约 |

2026-11-17：hutian 的新 Codex 请求由服务端统一管理长期记忆，显式关闭该运行的原生记忆读取和生成；原生会话续接与任务文件保留。其他 Dock 调用方和个人 Codex 设置不变。配置、旧会话边界及实测范围见 [服务端长期记忆](server-owned-memory-2026-11-17.md)。

不为内部层次新增服务、数据库或通用调度引擎。Runtime 配置归成员，提交后的请求保留冻结快照；更换成员 Runtime 不重放旧工作。

## 代码依赖

- `packages/contracts/src/`：浏览器可消费的 DTO、Zod schema、操作标识、错误与分页契约；不导入服务器代码。
- `apps/api/src/transport/browser/`：命令、REST 组合入口、上传/下载、SSE、上下文工具协议适配。旧 v1 名称只在兼容表中解释。
- `apps/api/src/application/`：按 conversations / members / resources / runtimes / schedules / workspace 划分用例。函数显式接收所需 `Pick<ApplicationServices, ...>`；组合根在 `application.module.ts`。不使用全局服务定位器或进程内 URL 分派。
- `apps/api/src/application/coordination/`：聊天、定时工作和记忆后处理的协调器；复用相同用例，不回调 Web。
- `apps/api/src/modules/`：领域状态、授权和 ORM 事务。成员 Runtime 的 HTTP 与页面命令共用 `setMemberRuntime` 验证用例。
- `apps/api/src/infrastructure/`：数据库迁移与工作流引擎接入。独立模块通过 SDK 接入，领域判断留在应用用例。
- `apps/web/src/components/conversations/`：会话目录、消息业务动作、草稿、消息投影、订阅/历史状态。通用渲染继续引用 Design。

ESLint 限制 Web 导入服务端/模块凭据 SDK、contracts 导入服务端、应用用例反向导入传输层，以及领域 Service 使用原始 `query()`。组合根和明确的 Repository 不受错误的“一刀切”限制。

## HTTP 契约与错误

World 新的 JSON 接口使用 `/v2`。成功响应：

```json
{"code":0,"msg":"success","data":{},"requestId":"..."}
```

失败使用对应 HTTP 状态，不以 HTTP 200 承载失败：

```json
{"code":40900,"msg":"记录已变化，请刷新后再操作。","data":null,"requestId":"...","recovery":"refresh"}
```

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | 40000 | 输入不符合 schema |
| 401 / 403 | 40100 / 40300 | 会话失效 / 授权拒绝 |
| 404 / 410 | 40400 / 41000 | 资源不可访问 / 已失效 |
| 409 / 422 | 40900 / 42200 | 并发冲突 / 当前业务条件不满足 |
| 429 | 42900 | 限流 |
| 500 | 50000 | 内部未确认错误，隐藏原始异常 |
| 502 / 503 / 504 | 50200 / 50300 / 50400 | 上游协议、不可用或超时 |

`recovery` 为 `none / reauthenticate / refresh / observe / retry`。它解释下一步，而不是让客户端自动重放写入。通信或资源响应丢失时沿原 transaction / operation / request / run ID 观察。

`ApplicationError` 才能携带显式公开的业务提示；普通异常、数据库错误、上游响应正文均不直接透出。Web 保留 code、HTTP status、requestId 和 recovery。UI 的 `ok/success` 是表单适配层状态，不是第二套 HTTP 成败协议。

命令标识采用 `members.setRuntime`、`conversations.read`、`resources.loadResources` 等领域名称，与源码文件名无关。请求 schema 和聊天/执行 DTO 在 contracts 中共享；原生工具动态参数保留 `unknown`，在协议边界验证，不伪造固定类型。

v1 暂为已打开页面及本机脚本保留，走同一用例；新增代码只用 v2。文件下载、SSE、上下文工具桥及 Matrix/Dock/Memory/Knowledge 各自的协议不嵌入 World JSON envelope。浏览器上传和历史 JSON 已走 `/v2/transport/`。

## 执行、交付与后处理

聊天请求的 `replied` 表示 Matrix 已确认回复交付，不能表示记忆整理成功。协调器在同一事务内更新回复状态并插入 `chat_effects` 意图；独立 DBOS 工作流随后提取记忆。

提取记录为 `pending / completed / attention`，保留 attempts、errorCode、nextAttemptAt 和人工重试 generation。已提交的资源操作只观察原 operation ID；失败退避，达到上限或授权不可恢复时进入 attention。服务端操作接口：

- `GET /v2/operations/chat-effects/:requestId`：检查原提取记录。
- `POST /v2/operations/chat-effects/:requestId/retry`：仅重试 attention，创建新的协调 generation，资源 operation ID 不变。
- `GET /v2/operations/chat-effects/observation`：查看 SSE 观察器和订阅数量。

这些接口只接受服务端应用凭据，不暴露给浏览器会话。后处理不改写已经交付的回复，也不重新执行原任务。

聊天与定时协调持久化观察失败次数/下一次观察时间；失败退避上限为 5 分钟。未知状态不会被当作失败后重派。并发条件更新保护终态和原生 runId；安排 occurrence 的唯一约束、事务锁和原始快照继续保留。

旧工作流名称、workflow ID、步骤顺序及 `applicationVersion: chat-v1` 保持不变。本次新增独立后处理工作流，没有在旧流程中插入持久步骤。以后改变 DBOS 步骤顺序时必须定义新版本或排空策略，不能只覆盖代码并沿用旧检查点。

## 工具授权

每个 grant 绑定空间、用户、资源连接、成员、原消息及原请求；新 grant 记录签发/到期时间。工具调用检查原请求与当前成员/资源范围、原生运行是否活跃、runId 是否一致。工作结束或超过最长有效期后拒绝调用。旧 grant 使用文件时间作为有界有效期基准，并沿原请求重新核验。

后台提取使用独立内部调用目的，并核对原请求已经交付及 replyEventId 一致；浏览器或工具调用方不能自行选择该目的。工具回执和摘要采用原子文件替换，意图仍用排他创建，未知结果不能重新执行同一写操作。

## 查询、订阅与持久化

通知和运行历史采用稳定游标分页，默认每页 50 条；资源目录也返回 nextCursor，Web 显式提供继续读取入口。会话历史沿 Matrix 原游标。成员/安排配置目录仍为当前单人空间的完整配置集合，不人为截断。

记忆列表优先使用源元数据；旧的泛化标题才读取原文投影标题，并限制并发。历史原文不改写，手动标题保持原名。

SSE 按身份、空间、连接及房间共享观察器；每个订阅先授权，持续观察再次核对权限。活动长轮询与快照复用到多个标签页，最后一个订阅离开即取消观察。慢消费者断开后通过权威快照恢复；停止观察不停止原生运行。

业务普通查询使用 EntitySchema / Repository。通知投影 upsert 和已读/撤销 compare-and-swap 的 PostgreSQL 特定 SQL 留在有作用域的 `ScheduleNoticesRepository`：必须保留同事务、行锁、原状态与 xmin 版本条件，不能为了形式统一拆成多次非原子写入。DDL 仅在显式 migration 中执行，`synchronize:false`。

## 部署、诊断和恢复

`/health/live` 只表示进程可响应；`/health` 和 `/health/ready` 核对数据库与协调引擎。可选资源模块不可用不判定整个 API 死亡。错误日志只记录关联 ID、路由模板、状态、错误码及类型，不记录请求正文、凭据、原始上游异常或查询串。

Matrix 可选宿主正式入口为相邻仓库 `host/web/server.ts`，启动 `pnpm host`。`examples` 仅保留兼容转发；原 `.local` 数据、原 Dock 应用身份、job/receipt hash 不变。`@hutian-ai/matrix-agents-chat/host-client` 检查 host protocol 1，版本不兼容显式失败。

本机由 launchd 管理服务。修改后先构建，再用 `node scripts/local-services.mjs restart api` 等按服务切换；不能并行启动占用相同端口的 dev 进程。Web 必须使用官方 build 脚本原子更新 HTML 并保留旧哈希资源。v1 兼容期覆盖旧页面，但新增功能不能继续增加旧协议分支。

运行 `node scripts/architecture-manifest.mjs` 输出模块提交、脏状态、源码/lockfile 指纹和协议组合。`link:` 本地开发不是不可变发行制品；未提交组合需同时保留私有源码快照，正式发布时再固定各模块版本。

恢复必须作为组合处理：

1. 核对原生运行和队列；保留 requestId / occurrenceId / runId / Matrix eventId。仅重启 HTTP 进程不能证明任意设备故障均能恢复执行。
2. 备份 World 数据库，包括 DBOS schema；同时保留 Matrix 数据、host 回执/队列/上传文件、World 私有授权/资源操作回执、Memory/Knowledge 原文与各自持久库，以及 Dock 原身份配置。只恢复 World 业务表会破坏跨模块关联。
3. 在隔离实例验证备份后，恢复匹配的源码/协议组合和凭据归属，再显式迁移；不把迁移 down 当作删除新状态的捷径。
4. 启动数据库及独立模块、宿主、API，再提供 Web；观察原记录是否完成，不新造替代运行。前端回滚只恢复 HTML，不能回滚 API、数据库或已产生的外部效果。

当前仍是可信本机单创造者部署。多用户公网、跨进程观察总线和高可用恢复不属于本次功能范围；本次也没有发布新 npm 包或公开 Release。
