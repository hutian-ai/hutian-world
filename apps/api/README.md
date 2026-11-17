# Hutian World API

NestJS + Fastify 的业务 API。按功能模块组织代码，数据库与 DBOS 共用应用级生命周期；继续使用现有 PostgreSQL、接口契约和执行宿主。

## 目录

```text
src/
  main.ts                      应用创建、监听与失败清理
  app.module.ts                根模块、全局 HTTP 组件与启动顺序
  config/                      c12 环境读取、Zod 校验和 ENV Provider
  common/filters/              跨模块 HTTP 异常处理
  infrastructure/
    database/                  单一 DataSource、公共列和历史迁移
    workflows/                 DBOS 的配置、启动与关闭
    chat-host/                 后台执行协调的兼容门面，进程内调用应用服务
  modules/
    access/                    本机身份、访问范围、鉴权与请求上下文
    workspace/                 总览聚合、旧会话覆盖兼容入口
    roles/                     角色资料、通信身份、成员 Runtime 绑定
    runtime-devices/           当前空间与 Dock 接入来源下的手动设备名称
    projects/                  项目与项目成员关系
    chat-requests/             聊天请求协调与聊天工作流
    schedules/                 安排管理、运行扫描、映射与定时工作流
    workbench/                 聊天、资源、工具、文件和前端命令的应用服务与适配器
    health/                    无用户数据的公开健康检查
  cli/migrate.ts               显式迁移命令
```

## 新代码放哪里

- 一个功能的 controller、service、实体和专用工具放在同一业务目录。小模块直接平铺，有实际需要再拆子目录。
- Controller 处理路由和输入解析；Service 处理业务与事务；Runner 管理后台扫描；工作流定义归对应业务。
- 模块通过 `imports` 和 `exports` 暴露服务，避免重复注册有状态 Provider。项目成员关系由 ProjectsService 管理，跨角色和项目的校验、关系读写保留同一数据库事务及归属过滤。
- WorkspaceService 聚合 Access、Roles、Projects 的公开查询，不承接角色和项目写操作。
- `common` 只放真正跨业务的 HTTP 机制；配置、数据库、工作流引擎和宿主 Client 各有明确模块，避免继续扩大公共服务。
- 前后端共享的 Zod 输入与响应类型继续放 `packages/contracts`，不再复制 DTO 验证规则。
- `entities/` 中的 EntitySchema 跟随所属业务；DataSource 统一登记。迁移集中放 `infrastructure/database/migrations`，已应用迁移不重写 SQL，不修改原类名和登记顺序。
- `chat-host` 为兼容原工作流保留名称，现直接调用 `workbench/services/chat-dispatch` 与 `scheduled-runs`，不回调 Web，也不通过管理员令牌自调用 HTTP。原运行授权上下文需覆盖整个应用服务调用。实际 Matrix/Dock 宿主连接由原接入适配器持有。
- Web 只访问正式 HTTP 接口与 `v1/commands` 显式白名单。`packages/contracts` 中的类型定义与后端命令注册表进行类型核对，不允许按客户端输入动态加载或任意调用模块导出。
- 浏览器使用 HttpOnly/SameSite 会话，后端校验本机 Host、请求来源与当前身份；原应用 Bearer 仅用于受信任的服务端调用。工具回调使用独立的按次授权，并在工具服务里重新校验范围。

## 数据访问约定

业务表使用 TypeORM `EntitySchema`，在所属模块的 `entities/` 定义并由单一 DataSource 登记。常规查询与增改使用 Repository；同一事务中的操作使用回调里的 EntityManager，不能混用全局 Repository。

安排、运行和聊天请求实体沿用现有记录与 mapper 的字段命名，不另加一层手写数据库行转换。权限条件必须保留 workspace、发起用户与创建者范围；运行读取复用 `SchedulesService.ownedRuns()`，按任务和空间同时关联。实体不会自动提供权限隔离。

批量防重插入使用 QueryBuilder 的 `orIgnore()`；后台选择通过悲观写锁与 `skip_locked` 抢占。JSON 路径、条件更新和 `COALESCE` 等 PostgreSQL 表达式可以放在 QueryBuilder / `Raw` 中，值必须绑定参数；不能先读后无条件写来替代原子条件。普通业务不直接调用 `db.query()`。健康探针的 `SELECT 1` 和显式 migration 保留 SQL。

DDL、索引、约束和数据回填仍以显式迁移为准，`synchronize:false`。历史空间迁移使用同目录冻结的 `local-identity.ts` SQL 辅助函数，不依赖不断演进的运行时 Repository 初始化；迁移 SQL、版本和顺序保持不变。停用的旧会话覆盖表继续保留，不因本次整理迁移或删除。

## 生命周期与兼容边界

1. 配置 Provider 读取原 `.local/app.env`；DatabaseModule 初始化连接并检查待应用迁移，不自动迁移。
2. Access 模块准备原本机身份；聊天和定时任务 Processor 在构造时注册。
3. 所有模块初始化完成后，AppModule 启动 DBOS，再启动聊天补收与定时扫描。
4. 关闭时先停止业务定时器，再关闭 DBOS，最后关闭数据库连接。

DBOS 应用名 `hutian-world-chat`、版本 `chat-v1`、schema `dbos_chat`、工作流名称、步骤名称与 `chat:<workspace>:<request>` / `schedule:<workspace>:<run>` 标识保持兼容。API 路径保持原值；旧会话覆盖 GET 返回空列表，PUT 返回 410。

## 运行与检查

在仓库根目录运行：

```sh
pnpm --filter @hutian-world/api typecheck
pnpm --filter @hutian-world/api build
pnpm exec eslint apps/api/src
pnpm db:migrate
pnpm services:status
```

`db:migrate` 仅在需要显式升级数据库时执行。常驻服务从 `dist/main.js` 启动；修改源码后先构建，再通过现有 launchd 服务入口重载 API，避免在相同端口另起 dev/start。

本次属于第 7 段的内部结构整理，保持未提交。验收记录见仓库的 `docs/stage-7.md`；私有调用快照和临时核对脚本保存在忽略的 `.local/api-structure-*` 中。
