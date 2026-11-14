# hutian-world

A Web workspace for conversations with persistent assistants, user-controlled Runtime execution, and source-grounded knowledge and memory.

The current local MVP opens to Communication, with private conversations, groups and topic channels in one directory. Knowledge, Memory, Members and Runtime remain directly accessible; project management is deferred. Existing member and project records persist in PostgreSQL. The interface uses Chinese.

Open a member and choose “发消息”, or invite the member into a group or channel. Hutian maintains a stable communication identity for each role and loads its current definition on the server for each new execution. The host freezes the definition version with the original request and receipt. Choose whether a message is only sent or explicitly asks a member to work. Set a member's default machine and Harness under **设置 → 执行配置**, or temporarily select another Runtime in chat. The server resolves the current member default for each new request; an unavailable target is reported without silently switching machines. Knowledge and memory retrieval are optional per request. Real replies return to the original Matrix room. The workspace reuses the old hutian [design system](DESIGN.md), [UI conventions](.agents/skills/hutian-world-ui/SKILL.md), shadcn registry config and assistant-ui components.

## Scheduled work

Open **http://127.0.0.1:3340/schedules** to save one-time, daily, weekly, monthly or every-N-day work. Choose a role, delivery room, fixed Runtime, time zone and start window. Preview future starts, pause/resume schedules, run once manually and read the original delivered message. The API checks durable schedules every 15 seconds, so the browser can close; the local API, Web, communication host and selected Runtime still need to be running. Apply migrations with `pnpm db:migrate` before starting the new API.

New occurrences freeze the saved task and use stable message/run references. Pausing does not cancel accepted work. The worker records missed windows instead of replaying stale work, and does not overlap one schedule's unfinished runs. Native tools use their existing permissions; scheduled task execution does not bypass approvals. The five existing stock-report schedules have been moved to the invitation-only “持仓与自选日报” channel and enabled; their original Codex automations are paused and retained. Their source rules, portfolio, watchlists and Chan script still live in the selected local trading workspace. This is schedule/workflow migration, not a rewritten market-data or trading engine. The selected Mac Runtime and services must remain available. See [stage 5](docs/stage-5.md) for actual validation and limits.

The stock role's private host config can point `DOCK_TASK_CLIENT_ARGS_JSON` at `apps/web/scripts/task-client.mjs`, using the existing public Dock SDK. Its private `.local/task-approval-policy.json` names the granted node, provider, `futu` server and exact allowed read methods; only a subset of the script's read-only catalogue is accepted. It responds to matching native requests with `allow_once` and denies unknown/account/trading requests. This does not modify native permission defaults. A private `.local/report-files.json` with `root` and `nodeId` optionally connects that local Runtime's report output directory; only files referenced by an authorized delivered message can be opened, and those are current local files rather than immutable snapshots.

## Run in the existing hutian workspace

Requires Node >=22.19, pnpm 11.24 and the shared local Docker PostgreSQL instance:

```sh
# Workspace root, if PostgreSQL is not already running
./infra/postgres/manage.sh start

cd hutian-world
pnpm install
pnpm setup:local
pnpm db:migrate
pnpm dev
# Once the API is running, in another terminal:
pnpm access:setup
```

Open **http://127.0.0.1:3340**. The API listens on **127.0.0.1:3341**. Both bind only to loopback. Stop the application with Ctrl+C; the database retains its data.

For communication, start Matrix Agents Chat (`pnpm web` in the existing `matrix-team-chat` directory) and its Synapse homeserver. The defaults are `http://127.0.0.1:3310` and `http://127.0.0.1:8008`; override them in `.local/app.env` with `HUTIAN_CHAT_URL` and `HUTIAN_MATRIX_URL`. The optional host's private `.local/host-connections.json` maps the `workspace` connection alias to Hutian's private Dock application credential file. The browser supplies neither a credential nor a filesystem path. Existing runs keep their original connection snapshot and receipt.

The current workspace already has private `.local/memory-client.json` and `.local/knowledge-client.json`. For a separate install, issue a scoped memory credential using [Scoped Memory Access](../infra/memory/access/README.md), then configure a knowledge connector with `url`, `token`, `workspace` and a private absolute `library` path. Knowledge originals live in that library; the upstream index is derived. Keep connector files mode 600. These are trusted server configurations, not user-facing model settings. Resource pages report a missing connection rather than inventing data.

Resource pages now distinguish **个人工作台 / 角色私有 / 会话共享**. Open a member's **资料与记忆** to add private sources. A two-person direct conversation can retrieve that role's private sources; groups and channels retrieve only their own shared sources. Existing workspace sources stay personal and are not silently shared. Chat displays the scope and links to its shared sources.

For automatic preparation of a new scope's memory, configure the existing Memory Access operator CLI once on the trusted Web host:

```sh
pnpm resources:setup --python /absolute/path/to/python3 \
  --admin /absolute/path/to/hutian_memory_access/admin.py \
  --policy /private/memory-access/policy.json \
  --url http://127.0.0.1:3332
```

This creates a private `.local/memory-provisioner.json` and never replaces an existing file. It must point to the policy directory mounted by the existing Memory Access service. First explicit memory save prepares a separate bank and read/write credential for that scope; reads of empty scopes do not provision anything. The Web host is a trusted local operator; these privileges are never given to the browser or native Runtime. Scope clients and new knowledge originals live in private `.local/resource-clients/` and `.local/resource-libraries/`. No new schema migration is needed. See [stage 4](docs/stage-4.md) for scope and sharing limits.

Runtime shows all machines authorized to Hutian by the configured Dock Server, grouped with the Harnesses each online machine reports. A machine and Harness pair is a distinct execution entry. Search by machine or Harness name and open a Harness directly to view its reported models. Offline machines remain visible; an inventory failure affects only that machine. Configure the service once via **运行环境 → 配置服务连接**, importing the application `client.json` issued by Dock Server. Hutian verifies it before saving it on the Web host in the private `.local/dock-client.json`. Individual machines pair with the same server through Harness Dock; viewing another machine does not require replacing the service connection. Use a verified WSS endpoint for remote Dock servers. Credentials with a custom CA file must be installed on the Web host with mode 600 and the referenced CA available to that host. [Harness Dock App guide](https://hutian-ai.github.io/harness-dock/app/)

`setup:local` creates the separate `hutian_world` database and non-admin `hutian_world_app` role using the existing workspace's private administrator configuration. It writes `.local/app.env` with mode 600 and retains existing configuration. It does not change old hutian or the other modules' databases. On a partial provisioning failure, inspect the actual account/database and private configuration before retrying; existing names are never silently reset.

```sh
pnpm typecheck
pnpm build
pnpm start
```

`build` builds contracts, API and Web in dependency order. `start` uses those builds. Development also builds contracts first; after changing contracts, rerun `pnpm dev` or rebuild the contracts package.

## Independent installation

Use your own PostgreSQL database and a dedicated application role that owns it. No vector extension is needed for this milestone.

1. Install dependencies with `pnpm install`.
2. Create a private `.local/` directory; copy `.env.example` to `.local/app.env`.
3. Set the database connection, a random API token of at least 40 characters, and a stable creator UUID. For example, generate the token with `openssl rand -hex 32` and the UUID with `node -e 'console.log(crypto.randomUUID())'`. Keep them in your private file, then `chmod 700 .local; chmod 600 .local/app.env`.
4. Run `pnpm db:migrate` and `pnpm dev`; once the API is running, use another terminal to run `pnpm access:setup`.

This first milestone is for trusted local use. The configured creator ID is used only by the local identity adapter. It resolves an application user, default data space and active membership; this is not a browser login or a multi-user session. The API token stays in the Next.js server, outside client bundles. Configure real user authentication and deployment boundaries before opening the application to other users.

## Layout

```text
apps/web       Next.js pages, Server Actions and UI
apps/api       NestJS + Fastify, business operations and database access
packages/contracts  Internal Zod inputs and response types
.local         Ignored configuration and real-use verification evidence
```

All application code stays in this repository. Internal packages are not separate open-source products. Database changes use explicit TypeORM migrations; application startup does not synchronize or migrate schemas automatically.

The database now also contains application users, default data spaces, memberships and module connection ownership. Business reads and writes use server-resolved scope; original role creators remain distinct from workspace membership. The database contains creators, projects, roles, a many-to-many project-role relation, role-to-chat identity mappings, and optional role Runtime defaults. Runtime defaults have their own revision and do not change the persona definition version. Changing project membership or execution Runtime preserves the role and its communication identity; existing runs retain their original target and receipt. Multi-user and role-scoped resource authorization, native session controls and project workflows remain incomplete. The conversation page currently reads the latest 100 text messages; the host uses a bounded 30-message context, not an unlimited transcript or native session migration.

Start with the [developer handoff guide](docs/tutorial/TECHNICAL.md) ([offline reading edition](docs/tutorial/index.html)) for startup/debugging commands, the database schema, request paths and host receipts. See the [resource scope delivery](docs/stage-4.md), [role-chat delivery](docs/stage-3.md), [core-module baseline](docs/stage-2.md), [MVP plan](docs/core-mvp-2026-11-13.md), [UI research](docs/ui-research-2026-11-13.md), and [technology choices](docs/technology.md). First-stage history remains in [stage 1](docs/stage-1.md). No public repository, npm package, Release or X post has been published by this implementation.

2026-11-14 定时任务交互更新：恢复旧 hutian 的周 / 月 / 日程日历，列表支持搜索、成员 / 状态筛选、分组和行尾菜单；标题打开侧栏预览，创建编辑使用独立页面。删除停止后续触发并保留运行历史。可直接查看 [11 月 16 日当周安排](http://127.0.0.1:3340/schedules?date=2026-11-16&future=all)，实际使用核对见 [第 5 段](docs/stage-5.md)。

日历默认按任务 ID 与北京时间日期合并同日摘要，周 / 月每格最多三条，其他从“更多”查看。点击摘要可核对当天全部触发与实际状态，各次触发在详情内查看；适用于所有任务，不按股票或标题分类，不改变后台周期。

## Identity and data scope foundation

[Stage 6](docs/stage-6.md) adds server-resolved request identity, explicit workspace / owner fields and composite foreign keys, plus persisted execution authority for scheduled work. Existing local connections are explicitly bound to one user and space in private `.local/access-bindings.json`; missing or mismatched bindings fail instead of using another default connection. Run `pnpm access:setup` after migrating and starting the API. It preserves upstream credentials and existing role / room / resource identities. This is still a single-owner local application: there is no login, invitation, tenant switcher or completed multi-user authorization product.
