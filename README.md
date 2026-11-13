# hutian-world

A Web workspace for conversations with persistent assistants, user-controlled Runtime execution, and source-grounded knowledge and memory.

The current local MVP opens to Communication, with private conversations, groups and topic channels in one directory. Knowledge, Memory, Members and Runtime remain directly accessible; project management is deferred. Existing member and project records persist in PostgreSQL. The interface uses Chinese.

Choose whether a message is only sent or explicitly asks an assistant to work. Before execution, select an available Runtime; knowledge and memory retrieval are optional per request. Real replies return to the original Matrix room, with links back to saved sources. Matrix holds the messages. The workspace reuses the old hutian [design system](DESIGN.md), including its [UI conventions](.agents/skills/hutian-world-ui/SKILL.md), shadcn registry config and assistant-ui components.

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
```

Open **http://127.0.0.1:3340**. The API listens on **127.0.0.1:3341**. Both bind only to loopback. Stop the application with Ctrl+C; the database retains its data.

For communication, start Matrix Agents Chat (`pnpm web` in the existing `matrix-team-chat` directory) and its Synapse homeserver. The defaults are `http://127.0.0.1:3310` and `http://127.0.0.1:8008`; override them in `.local/app.env` with `HUTIAN_CHAT_URL` and `HUTIAN_MATRIX_URL`. The optional host's private `.local/host-connections.json` maps the `workspace` connection alias to Hutian's private Dock application credential file. The browser supplies neither a credential nor a filesystem path. Existing runs keep their original connection snapshot and receipt.

The current workspace already has private `.local/memory-client.json` and `.local/knowledge-client.json`. For a separate install, issue a scoped memory credential using [Scoped Memory Access](../infra/memory/access/README.md), then configure a knowledge connector with `url`, `token`, `workspace` and a private absolute `library` path. Knowledge originals live in that library; the upstream index is derived. Keep connector files mode 600. These are trusted server configurations, not user-facing model settings. Resource pages report a missing connection rather than inventing data.

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
4. Run `pnpm db:migrate` and `pnpm dev`.

This first milestone is for trusted local use. The configured creator ID selects the local owner's records; it is not a browser login or a multi-user session. The API token stays in the Next.js server, outside client bundles. Configure real user authentication and deployment boundaries before opening the application to other users.

## Layout

```text
apps/web       Next.js pages, Server Actions and UI
apps/api       NestJS + Fastify, business operations and database access
packages/contracts  Internal Zod inputs and response types
.local         Ignored configuration and real-use verification evidence
```

All application code stays in this repository. Internal packages are not separate open-source products. Database changes use explicit TypeORM migrations; application startup does not synchronize or migrate schemas automatically.

The database contains creators, projects, roles and a many-to-many project-role relation. Changing project membership preserves the role. This MVP invokes configured Matrix assistants through the independent host; formal business-role-to-chat binding, multi-user resource authorization, native session controls and project workflows remain incomplete. The conversation page currently reads the latest 100 text messages; the host uses a bounded 30-message context, not an unlimited transcript or native session migration.

Start with the [developer handoff guide](docs/tutorial/TECHNICAL.md) ([offline reading edition](docs/tutorial/index.html)) for startup/debugging commands, the database schema, function-level request paths, host receipts and a first code change. The earlier product walkthrough is retained as an appendix. See the [current MVP plan](docs/core-mvp-2026-11-13.md), [current stage record](docs/stage-2.md), [UI research and access limits](docs/ui-research-2026-11-13.md), and [technology choices](docs/technology.md). First-stage history remains in [stage 1](docs/stage-1.md). No public repository, npm package, Release or X post has been published by this implementation.
