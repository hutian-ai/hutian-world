# Web 与后端边界审计

日期：2026-11-15。状态：原审计保留，后续已按本方案完成迁移，见[交付记录](backend-boundary-delivery-2026-11-15.md)。用户已明确 Web 项目只承担前端职责，后端逻辑应收拢到独立后端。

## 架构判断

现有 `apps/api` 就是 hutian Server，采用 NestJS 模块组织业务、授权、持久化与外部模块接入。保留 `api` 名称即可；没有必要为了命名再增加一个 `apps/server` 并把原应用降为转发网关。

长时间的原生执行继续由独立 chat-host / Dock 宿主持有。需要单独部署后台工作时，可以从同一后端模块启动 worker 入口，复用同一套业务服务和正式状态。Worker 是进程生命周期的拆分，不新增一套业务服务或一层对内 HTTP 网关。

只有多个可独立部署的业务后端确实需要统一对外路由、限流、协议转换或不同网络信任边界时，才单独引入网关。当前 API 已拥有角色、身份、安排与运行请求，主要问题是职责仍有一部分散落在 Web，增加转发层不能解决它。

## 迁移前源码发现

| 当前职责 | 位置 | 目标归属 |
| --- | --- | --- |
| 角色、身份、安排、运行请求与 DBOS 协调 | `apps/api/src/modules/`、`infrastructure/workflows/` | API 后端 |
| 记忆、知识、来源、偏好引用与资源连接 | `apps/web/src/lib/resources.ts`、`resource-provisioning.ts` | API 资源模块及基础设施适配 |
| 工具定义、范围授权、调用回执、摘要与提取 | `apps/web/src/lib/chat-context-tools.ts` | API 工具与上下文模块 |
| 会话成员校验、角色指令、运行派发与人工交接 | `apps/web/src/lib/communication-actions.ts`、`communications.ts`、`role-chat.ts` | API 聊天应用服务 |
| 聊天与安排后台执行入口 | `apps/web/src/app/api/chat-dispatch/`、`scheduled-runs/` | API 后台协调，不回调 Web |
| 文件上传、输入输出、附件下载与流式事件 | Web 的其他 `app/api/` 入口及 `report-attachments.ts` | API 文件和事件入口 |
| Dock 凭据读写与设备查询适配 | Web `dock.ts`、`dock-actions.ts` | API 连接模块，复用既有宿主连接 |
| 页面、交互、输入草稿与展示格式化 | `apps/web/src/components/`、页面及展示工具函数 | Web 前端 |

明确的反向依赖：`apps/api/src/infrastructure/chat-host/chat-host.client.ts` 实际请求 `http://127.0.0.1:3340/api/chat-dispatch` 与 `/api/scheduled-runs`，由 Next.js 服务端继续处理。当前 API 并未完全独立于 Web 运行。

## 目标调用关系

- 浏览器 → API HTTP / SSE：页面数据、命令、运行状态、审批、上传和下载。
- API 业务服务 → Matrix / 记忆 / 知识 / 执行宿主：通过适配器访问，不复制它们的权威数据。
- API → Dock 宿主 → 本次 Agent：提供冻结的角色指令、相关上下文和获授权工具。
- Agent → Dock MCP 工具桥 → API 工具入口 → 同一套业务服务。
- 独立 Hutian MCP 若开放，作为 API 业务服务的协议适配，不能另写业务与授权实现。

API 内部 Controller、MCP 适配、定时协调共享应用服务，不能通过回调 Web 或用后台管理员凭据自调用 HTTP 来模拟当前用户。后台工作从正式运行快照恢复授权上下文。

## Web 的明确边界

前端只保留页面渲染、交互状态、客户端请求、输入校验反馈及纯展示函数。以下内容迁出 Web：

- Runtime、Matrix、记忆和知识连接凭据。
- 私有 `.local` 文件读写、数据库访问、进程启动与权限判定。
- 有业务副作用的 Server Actions、动态 API Route Handlers。
- 作业派发、后台恢复、工具调用与记忆提取。

纯前端是运行边界。最终应能产出静态资源，并由静态服务器托管；不能仅把 Next.js 服务端代码改名后继续依赖 Next 运行时。动态成员和会话 URL 也必须在静态托管与浏览器路由下正常打开、刷新。是否继续使用 Next 的静态前端模式，由路由与构建适配决定，不要求同时更换 UI 组件体系。

## 身份与凭据迁移

当前 API 入口使用应用级 Bearer 凭据，由 Next.js 服务端代持。移除这层后，不能把 `HUTIAN_API_TOKEN` 改成公开环境变量交给浏览器。

浏览器身份需要由后端建立会话并处理来源校验与 CSRF；同源部署可将 `/api` 路由到 API。应用级模块凭据继续留在后端。Agent 工具授权继续绑定当前用户、空间、角色、会话及运行，独立于浏览器会话。此调整不自动扩成多人账号、组织或跨用户共享交付。

## 迁移顺序和验收边界

1. 把资源、授权、工具及聊天协调迁入 API，保留原标识、操作回执和数据来源。
2. 让后台工作直接调用后端应用服务，切断 API → Web 的调用。
3. 给前端提供完整的 HTTP / SSE / 文件接口与浏览器身份入口，再替换 Server Actions 和页面服务端取数。
4. Web 达到静态部署边界，撤去动态服务端入口及私有依赖。

验收必须包含：停止整个 Web 进程后，聊天原执行及工具调用继续，后台安排和提取仍工作；恢复页面能够读取同一原运行；纯静态前端能登录当前本机身份并完成私聊、群聊、资源、附件和审批的最短路径；浏览器构建产物中没有应用级或模块凭据；群聊仍不能读取角色私有资源；Mac / Windows 原 Runtime、配对及回执保留。没有完成这些检查前，不称为已完成前后端分离。

## 参考

- [NestJS Modules](https://docs.nestjs.com/modules)：同一后端内以模块和应用服务组织职责。
- [NestJS standalone applications](https://docs.nestjs.com/standalone-applications)：需要独立 worker 时可复用模块，不必创建额外业务服务。
- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports)：静态部署不提供运行时 Server Actions 等服务端能力。
