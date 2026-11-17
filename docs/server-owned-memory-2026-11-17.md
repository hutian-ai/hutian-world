# 服务端长期记忆与本地执行

2026-11-17，用户确认实施。目标是新派发的 hutian Codex 任务只使用服务端授权长期记忆；继续保留任务文件、原生会话续接与原运行核对。当前阶段不迁移个人 Codex 记忆，不建立第二份记忆同步，不新增界面开关。

## 所有权与实施契约

- hutian API 按成员/会话授权调用 memory-access，准备参考资料并提供记忆工具；Hindsight 持有记忆。知识原文与工作资料仍由知识服务持有。关闭本次 hutian 记忆使用不会退回个人本地记忆。
- API 为所有新 Codex 请求加入 `config.nativeMemory = "disabled"`。聊天、后台工作与定时工作共用此入口。Matrix 执行宿主仅透传并冻结这项配置；不获得 hutian 的记忆权限。
- Dock 的 Codex adapter 接受该可选值；缺省继续使用原生配置，其他调用方不变。它使用已有 ACP 进程参数和会话配置同时关闭 `features.memories`、`memories.generate_memories`、`memories.use_memories`，不写原生 home/config/auth。
- nativeMemory 进入既有请求指纹、原生恢复环境及宿主 session key。新请求因此不会复用先前未关闭原生记忆的会话。原会话、历史、回执不删除；已派发/排队的冻结请求不改写、不重放。新的任务由授权 Matrix 历史和服务端记忆恢复上下文，之后仍可续接同一原生会话。
- 服务端指令明确长期记忆读取/写入通过本次授权工具完成，不主动读写设备用户的 Codex memories。该行为约束和原生开关不等同操作系统文件隔离；原执行权限仍允许的本地文件能力不在此变更中收紧。

## 失败与验收

未知配置值拒绝，旧版 Dock 不支持时明确失败，不能静默带着原生记忆执行。请求状态未知继续核对原运行，不创建替代任务。配置/会话隔离不得改变原始 runId 和结果所有权。

复用已有编译与 Dock 检查；以私有真实探针核对三个生效开关、缺少原生 Memory 注入、会话续接、授权服务端资料与个人 config 文件未变。服务重载前核对空闲；Windows 等未运行平台只报告源码状态。执行结果在本文件追加，不预先宣称完成。

## Local 验证结果

- API build、Matrix 宿主 `pnpm check` 与 Dock `pnpm check` 通过；Dock 原有 198 项中 191 通过、7 项按原条件跳过，原生面板检查通过。只扩充既有原生配置边界测试，没有新增永久测试、fixture 或测试框架。
- 实际 Codex `0.167.0-alpha.3.2` 确认三个开关关闭。两轮真实推理之间关闭执行进程，再通过同一原生 thread 续接，第二轮正确取回第一轮临时口令；无需长期记忆或任务文件。
- 检查该运行的原生记录：没有自动 Memory 指令/摘要，SQLite thread `memory_mode = disabled`；个人 config.toml 前后摘要一致。
- 本机 API 按既有成员范围查询真实服务端记忆，返回 5 条参考；通过当前 Matrix 执行桥和已重载 Dock 使用原应用/设备身份执行只读探针，正确接收服务端资料。冻结回执含 `nativeMemory: disabled`，该运行的原生提示与 memory_mode 再次验证通过。没有向用户会话发送测试消息，也没有生成测试长期记忆。
- 本机 API、宿主和 Dock 空闲时完成重载，服务健康；新任务生效。原始会话、排队/运行快照、回执、定时配置和个人原生记忆未修改。远端 Windows 执行端尚未部署或实测；旧版 Dock 会拒绝新配置，需升级后才能运行新策略。
- 私有证据：`harness-dock/.local/server-memory-20261117/`、`matrix-team-chat/.local/server-memory-20261117/` 与本仓库 `.local/server-memory-20261117/`。未发布新的安装包。
