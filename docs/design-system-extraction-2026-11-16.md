# 设计系统分离交付 · 2026-11-16

## 现在可以使用

相邻 `hutian-design` 是独立本地 Git 项目，包名 `@hutian-ai/design`，目前没有 commit、remote、推送或发布。Hutian 已通过本地 link 引用这份代码；不是另做一份展示用副本。原第 7 段及本次改动保持未提交，未触碰 Matrix / Dock 原身份、模型、权限、数据或日报配置。

展示入口：http://127.0.0.1:3342 。macOS 用户级 launchd 服务 `org.hutian.design.showcase` 已启用，读取已构建的静态展示，Codex 退出后继续运行。当前只监听本机地址，不连接业务服务。

```sh
# 在 hutian-design
pnpm dev                 # 先停止持续预览以释放 3342
pnpm typecheck
pnpm build:showcase
pnpm showcase:start
pnpm showcase:status
pnpm showcase:stop

# 在 hutian-world
pnpm design:build
pnpm design:dev          # 同一展示入口，避免并行占用 3342
pnpm build              # 先构建设计依赖，再执行原应用构建
```

## 源码与数据边界

- 主题、CSS 变量、基础样式 → `hutian-design/src/styles/index.css`；Web globals.css 保留产品页面布局。
- 原通用 UI、assistant-ui、Beautiful UI、hooks / cn → 设计项目对应目录；Web 使用显式包子路径。原 66 个组件、辅助文件与 notices 比对后，仅改本地 import 路径。
- 实际聊天消息外框、成员身份区、空等待与发送/停止按钮 → `src/chat/message.tsx`、`send-button.tsx`；业务动作仍通过回调提供。
- 执行过程、折叠、思考摘要、工具、原生问答/审批呈现、成果预览 → `src/chat/execution.tsx`，消费 UI 模型 `types.ts`。
- Dock/Matrix 原生事件解释 → Web `chat-execution-projection.tsx`；接口、授权 URL、原成果正文读取 → Web `chat-execution.tsx`。设计项目不导入业务 contracts、产品源码、API、数据库或私有配置。
- 设计项目只保存呈现状态；原消息账本、持久队列、原生运行与回执仍属于已有模块。
- 三个 assistant-ui 包与 React/React DOM 保持 peer dependencies；消费方 Vite 去重，防止跨项目出现多份 context。Tailwind @source 显式覆盖设计源码，消费方构建自己的页面样式。

设计项目源码文件数：{"ui": 40, "assistant-ui": 16, "beautiful-ui": 3, "chat": 4, "hooks": 4, "lib": 1}。

## coding 模型入口

`hutian-design/AGENTS.md` 和 `DESIGN.md` 是精简入口，按颜色/基础组件/消息输入/工具过程分流到对应源码和规范；组件展示场景独立在 apps/showcase。Hutian 原 1084 行 DESIGN.md 已按归属分开，应用入口只保留现行产品决策与路由，详细页面规则定向读 docs/ui/product-patterns.md。

本次减少默认需要读取的工程与文档范围，不保证模型自动永远只加载这些文件。后续 UI 任务直接在独立项目打开最清楚；修改业务逻辑才回应用。通用组件 registry 配置已移到设计项目，Web 不再生成共享 UI 副本。

## 已完成的核对

- 设计项目 typecheck、库构建和展示页生产构建通过。
- Web typecheck、生产构建通过；本地包的冻结锁文件过滤安装通过。
- Chrome 真实展示交互：完成折叠、公开思考摘要、工具分组及详情、成果预览、空等待、审批提交待回执、结构化提问、失败、停止、未知、输入发送、附件添加移除、基础弹窗及 Escape 关闭。控制台错误 0，页面横向溢出 false。
- Hutian 真实聊天目录和已有私聊记录可以读取；原思考、工具、停止和正式回答呈现保留。向原 Mac 验收助手发送一条专用请求，先进入原持久队列，随后取得真实原生回复 `DESIGN_SPLIT_OK`，页面错误 0、横向溢出 false。
- 这条验收最初等待宿主已有股票日报；核对期间原队列自动派发。曾尝试取消该验收队列项，因已派发未生效；没有停止日报、重复发送或创建替代运行。最终原请求成功完成，原消息与回执保留。不据此承诺固定延迟。
- 没有新增测试代码、fixture、测试框架或 CI。浏览器检查通过临时脚本完成，结果和截图仅在私有 .local 中。

原始证据：`hutian-design/.local/acceptance/showcase-checks.json`、`hutian-private-result.json` 及截图；移动前快照保存在 `hutian-world/.local/design-extraction-20261116/before.tgz`，未进入 Git。

## 限制与交付状态

展示场景明确使用示例数据，状态手动切换，不代表真实模型执行；流式片段示例不制造自动 token 计时器。原生审批、停止、文件传输的服务端权限与跨设备流程本轮没有重新全量验收，沿用原模块；只核对这次迁移影响的最短路径。

本地消费要求两个项目同级、先安装并构建设计项目。尚未发布 npm 包、创建远端仓库或配置发布流水线。库修改后重新 build，再重建 Web；展示页开发直接热更新源码。当前 Vite 仍提示较大 JS chunk（聊天/Markdown 等既有依赖），这次没有扩展为拆包性能优化。

第三方 notices 随源码保留；[分享草稿](../../hutian-design/docs/share-draft.md)仅为草稿，没有公开发布。

## 同日后续：升级为文档站

用户指出原展示过少，随后明确希望对齐设计系统文档网站。当前入口已升级为 59 页文档站：3 篇开始使用、4 篇设计基础、40 个基础组件页与 12 篇 Chat UI 文档，支持搜索、交互预览、代码、属性与实际源码。实际应用目录现为 hutian-design/apps/docs，原 showcase 命令为兼容入口。详细范围与浏览器核对见 [文档站交付](../../hutian-design/docs/documentation-site-2026-11-16.md)。这次没有改生产组件和业务权限，保持未提交、未发布。
