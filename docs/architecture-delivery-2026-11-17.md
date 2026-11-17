# 2026-11-17 架构重整交付

本轮按“功能保持不变，重新设计技术实现”的授权推进。现行规范见 [architecture.md](architecture.md)；[原评审](architecture-review-2026-11-17.md) 保留当时的问题和源码位置，不再作为当前目录索引。

已实施：移除伪 HTTP 与全局业务分派；按领域显式注入应用依赖；共用成员 Runtime 用例；v2 HTTP envelope、错误分类、脱敏和 requestId；共享 schema/领域操作名；回复与持久记忆后处理分离；工具 grant 生命周期；观察失败退避；通知 Repository；游标分页；按授权范围共享 SSE；拆分前端聊天业务组件；Matrix 正式 host 入口与版本化客户端；就绪检查、组合清单与恢复规范。基础 Design、Matrix/Dock 的权威归属和原生配置规则保持不变。

本次不新增永久测试代码或框架。必要构建、既有 lint 与最短真实路径的证据保存在 `.local/architecture-20261117/`，其中含私有数据，不提交。

## 验收记录

- contracts/API 构建、Web 类型与官方构建、Matrix check/build 已通过；本次重构边界的既有 ESLint 与 `git diff --check` 通过。另一个任务正在开发的工作资料应用文件不纳入本次 lint 结论。
- v2 成功 envelope、401/400/404、无效 Runtime 在 REST/命令入口均为相同 50300，以及 v1 旧操作别名已实测。
- ORM 通知读取、运行分页及无效游标 400 已实测。迁移前快照中原有 22 个安排、40 条运行在第一次完整切换核对时逐项一致；同工作区其他功能任务随后仍可能新增记录。
- 本机 Chrome 检查沟通、组织、安排、收件箱、记忆、知识及 Runtime 七个入口；没有页面脚本错误或横向溢出。使用保留的旧 HTML/旧哈希资源进入工作台并导航到组织页成功。桌面 CUA 不可用时改用已有 Playwright/Chrome，未新装测试框架。
- 两个相同身份/房间 SSE 订阅只增加一个观察器；关闭后观察器与订阅计数都回到原值。
- 原生聊天首轮确认：消息重复提交保持同一 eventId，执行后 Matrix 回复先交付，记忆后处理仍 pending；随后同一提取记录 completed。完成后旧工具 token 返回 403。首轮验收提示使用了不存在的工具名，模型如实未调用；后续使用实际 `search_context` 单独核对工具链路。
- 第二轮实际调用 `search_context`，原生事件包含 started / completed，Matrix 回复为 `ARCHITECTURE_OK`。原请求依次 accepted / preparing / running / replied，提取在回复后仍 pending，观察一次未确认后沿同一记录完成。请求重复提交未产生新的运行；完成后工具 grant 为 403。整个观察耗时包含提取阶段，不作为原生回复延迟指标。
- 最后重启后 `/health/live`、`/health/ready`、会话读取、安排分页和提取检查均为 200；原 runId、replyEventId 和提取完成状态保持。API 启动时因同工作区另一任务新增的 `WorkDocuments1794990000000` 迁移待应用而被结构检查拦截；核对其只新增表后显式应用，三项服务恢复健康。没有回滚或删除业务数据。

私有证据包括 `acceptance.json`、`live-result-2.json`、`observer-result.json`、`browser-result.json` 和 `final-check.json`；源码快照、数据库备份与组合指纹也保存在同目录。验收对话归档保留消息/回执，提示明确标记为联调内容，不作为用户偏好。工具结论来自原生事件，未把模型自述当作调用证据。

这些检查覆盖本次变更的主要链路；没有以此声称完成设备任意故障恢复、所有供应商组合或高负载验收。

## 使用与交付状态

本机继续使用 `http://127.0.0.1:3340`。入口和业务用法保持原状；较早通知、运行及资源原文可继续分页读取。服务启动和检查仍用 `pnpm services:start|status|stop`，也支持 `node scripts/local-services.mjs restart api|web|chat-host`。

2026-11-17 用户确认本地提交。使用改造前后源码快照，在隔离工作树分别整理前置交付与架构重整，World / Matrix 各自保留阶段提交。正在开发的工作资料、成员详情和教程等并行改动不混入架构提交，原工作区内容完整保留。提交树重新核对类型与构建；没有推送或发布。未将多用户、公网部署、原生 IDE 或自主编排纳入本轮。
