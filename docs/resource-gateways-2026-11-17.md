# Memory 与知识模块独立接入

2026-11-17：本机实现与真实验收完成，本轮按用户授权提交源码。Memory、Knowledge 与 World 源码均已按用户授权在 `hutian-ai` 组织公开。此次源码交付不包含 npm、PyPI 或容器镜像发布。

## 协议与插件的归属

两层契约同时存在，但职责不同：独立模块定义领域能力，Hutian 定义宿主如何接入能力。做成插件不意味着把模块协议搬进 World。

| 归属 | 实际责任 | 本轮位置 |
| --- | --- | --- |
| Memory Gateway | 写入语义、检索、来源、操作状态、资源授权、Hindsight/Mem0/笔记适配、客户端类型 | `../memory-access/PROTOCOL.md`、`hutian_memory_access/`、`sdk/` |
| Knowledge Gateway | Markdown 原文、不可变版本、索引状态、检索出处、资源授权、AnythingLLM 适配、客户端类型 | `../knowledge-gateway/PROTOCOL.md`、`knowledge_gateway/`、`sdk/` |
| World 内置插件 | 注册、配置解析、连接、连接检查、受限资源准备，调用模块 SDK | `apps/api/src/modules/resource-plugins/registry.ts` |
| World 业务 | 用户／成员／会话授权、资源绑定、上下文选择、产品来源链接 | `apps/api/src/modules/workbench/services/resource-scopes.ts`、`resources.ts` |
| Web | 用户输入、当前范围、状态及原文展示 | `apps/web/src/components/resource-workspace.tsx` |

资源调用路径：Web 或原生执行工具 → Hutian API 核验当前业务范围 → 内置插件／模块客户端 → 独立网关核验资源凭据 → 模块后端。浏览器不持有网关、管理或底层服务凭据。后台直接调用相同的后端应用服务，不回调 Web。

这是固定注册的服务端插件，不支持动态安装、任意浏览器提交代码、市场或热更新。Design 仍作为组件依赖。若以后只替换 Memory 后端，适配工作留在 Memory Gateway；若更换整个模块协议，才需要新的 World 接入插件。当前没有为未知需求新增通用插件 SDK 仓库。

## 已实现

- 两套模块各自提供 TypeScript 客户端，拥有 HTTP 路径、结构校验和错误语义。World 不再手写 Memory 接口或调用本机 Python CLI 准备资源，不再持有 AnythingLLM 适配、原文读写和版本判定。
- 受限管理入口使用独立 host token；操作员固定资源 ID 规则、后端连接、命名空间与读写权限。普通资源 token 不能管理。重复准备返回同一资源凭据，不恢复已撤销凭据，也不更换现有资源绑定。
- Knowledge Gateway 提供 REST、MCP、CLI；先保存原文，再建立索引。原 ID 重试只观察原结果；`failed`、`unknown` 和 `ready` 分开。旧版本按原 ID 读取，只有已确认 ready 的新版本替换当前检索版本。每个资源的原文目录与索引命名空间互相隔离。
- 原六份知识资料通过操作员绑定原目录接入，ID、原文和版本链不变，没有重新导入或重建索引。原 Memory 资源和凭据保留。
- 页面显示真实知识版本，区分失败和未知；旧版本深链接按 ID 取原文。实际旧 Hindsight 召回含空 metadata，已修正 Memory SDK 兼容；AnythingLLM 检索的 embedding 元数据前缀由其适配器移除，原文不变。

## 实际验收

| 路径 | 观察结果 |
| --- | --- |
| Memory 独立 SDK | v1 列表／原文／召回兼容读取、v2 能力查询、旧来源读取、新写入、沿同一操作从 accepted 到 completed、实际检索返回该来源 |
| Knowledge 独立 SDK | 导入版本 1、检索、导入版本 2、旧原文保持、当前列表与历史分开、同 ID/同输入不重复导入 |
| MCP／CLI | Memory 13 个 MCP 工具与来源读取；Knowledge 6 个 MCP 工具与来源读取，独立 CLI 发现／原文／操作查询 |
| 模块权限 | 两模块跨资源读取被拒绝；普通 token 管理被拒绝；只读 token 写入 403，撤销后读取 401；重复管理调用稳定 |
| 知识未知结果 | 首次验收的网络配置错误保留 unknown 原文；修复连接后以明确独立的新验收资料检查，原 unknown 记录未重放 |
| World 页面 | Mac 验收成员分别添加记忆和知识，等待处理、检索、打开来源；知识旧引用打开版本 1，当前列表保留版本 2；不存在的成员范围被拒绝，无浏览器运行错误 |
| 真实私聊 | Mac 验收成员实际调用 `search_context`、`read_knowledge`、`read_memory`，返回苍松邮筒 KG-271 与银杏纸船 MG-418 及原文链接；原运行状态 replied |
| 真实群聊 | 同一成员搜索两个标记，仅返回会话共享内容，未取得私有资料；使用真实群聊工具授权直接读取两种私有来源均被拒绝 |
| 重启与保留 | 仅重启两网关，原操作 completed、两个知识版本和原 unknown 仍在；六份旧文件 SHA-256 一致，切换前 Memory 资源与凭据记录一致 |
| 工程检查 | 两 SDK 编译、Python 编译、World contracts/API/Web 相关类型与构建通过；更新后的配置脚本拒绝覆盖现有文件；未新增测试工程；新增与修改源码扫描未发现凭据 |

验收资料均明确标记为临时内容，不是真实用户偏好。Hutian 既有会话后台提取机制仍保留；Agent 没有主动调用记忆写工具不等于宿主没有生成有来源的会话记录。此次未修改其产品规则。

私有原始结果在工作区 `.local/gateway-acceptance-20261117/`：`independent-summary.json`、`world-ui-results.json`、两份 `world-*-state.json`、`boundary-results.json`、`history-ui-result.json`、`restart-results.json`、MCP/CLI 日志与页面截图。含授权信息的中间记录只留私有目录，不提交仓库。

## 独立使用与首次接入

独立安装命令分别见两个网关的 README。两者能脱离 World 通过 REST/MCP/CLI/SDK 使用。知识首版需要已配置 embedding 的 AnythingLLM；Memory 沿用原后端配置。

World 当前使用相邻仓库的 SDK，本轮没有发布 npm 包：

```sh
# workspace root
pnpm --dir memory-access/sdk install
pnpm --dir knowledge-gateway/sdk install
cd hutian-world
pnpm install
pnpm gateways:build
```

操作员在网关中配置受限 host issuer，再通过 `pnpm resources:setup --kind memory|knowledge --config /absolute/private/host-client.json` 导入服务端管理连接。文件需 mode 600，结构为 `url` 和 `token`；不在命令行传 token。已有配置拒绝覆盖。操作员也可以手动签发各范围凭据而不启用 HTTP 管理入口。

## 本工作区的显式接管

以下为已有相邻仓库部署的操作记录，不是每次启动动作：

1. `python3 scripts/prepare-resource-gateways.py` 读取既有授权命名空间和知识配置，生成私有策略、凭据、目录绑定、原文哈希清单与 Compose 配置。此步不切换 World，不移动原文或改索引。
2. 先为原 Memory Gateway 容器配置 `MEMORY_ADMIN_CONFIG=/run/memory-access/host-provisioning.json`，将原策略目录 `../../.local/memory/access:/run/memory-access` 挂载为可写；保留原 policy、state 和所有其他连接配置。然后在工作区根目录运行 `./infra/memory/manage.sh access-restart`。这些是本地 infra 配置要求，Memory 模块 README 同样说明管理接口的配置方式；Hindsight 本身不重建。
3. 工作区根目录运行 `./infra/postgres/manage.sh docker compose -f .local/knowledge-gateway/compose.json up -d --build`。服务 `hutian-knowledge-gateway` 监听 loopback 3333，复用现有 Docker 网络访问 `hutian-knowledge:3001`；重启策略为 unless-stopped。
4. 两网关健康后，在 World 运行 `python3 scripts/prepare-resource-gateways.py --activate`。旧连接备份在 `.local/resource-gateways/backups/`，原文清单在 `.local/resource-gateways/original-documents.json`。原 `.local/knowledge-client.json` 留存。
5. 构建 API/Web 后，确认没有需要保持连接的前台工作，再重载 API。Web 使用原子构建发布；不重启聊天宿主、Dock、Matrix 或数据服务。`pnpm services:status` 当前三服务均健康。

新知识空间的原文存放在网关 state 中；旧空间按绑定仍读原目录。不要把 World 旧的 `.local/resource-libraries` 目录存在与否当作新资源的唯一清单。以后增加 legacy 目录绑定需要操作员明确检查 Docker 挂载；普通 API 不接受路径。

## 故障恢复与限制

先恢复同版本网关和 API，核对原 ID；连接失败不自动重复导入或写入。后台处理 completed 与实际检索可见是不同事实，本轮都以真实检索核对。

若必须退回旧实现，先停止新的资源写入，保留当前代码、模块策略、凭据与全部原文，再从私有备份核对原连接并切回对应旧构建。不能只还原旧配置或清空新 state：切换后新建的资源可能不在旧 World 的目录布局中，应先明确处理其绑定与可见性。此次没有执行回滚或删除任何数据。

范围：本机受信任操作员部署；Knowledge 单进程 worker、Markdown 与一个 AnythingLLM 适配器。未承诺自动修复未知索引、跨后端迁移、PDF、多 worker、高可用或第三方托管服务全部实测。Memory 原有后端验证边界继续有效。动态插件管理、多用户公网认证、模型／权限配置和 Runtime 私有资产同步均未扩展。
