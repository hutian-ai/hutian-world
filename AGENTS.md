# hutian-world

- Product: a Web workspace for persistent roles and human-coordinated projects. Creators, roles, projects, business grants, tasks and acceptance belong here. Native Harnesses own inference, local assets and sessions.
- Stack: Next.js / React / Tailwind / shadcn-style Radix primitives, NestJS with Fastify, TypeORM with PostgreSQL, TypeScript and pnpm. Reuse the old hutian design system; do not copy its database or workflow infrastructure.
- For UI changes follow `DESIGN.md` and `.agents/skills/hutian-world-ui/SKILL.md`. Start from the matching old hutian page and its shared components, then adapt its data and actions to the current app. Use assistant-ui for conversation history, threads and composers.
- Prefer small complete usable stages. The first stage has members, local private chat, projects, project-role membership and Dock connection settings. Keep empty states and real error handling; do not seed invented online Agents, execution results or metrics.
- Latest completed stage stays uncommitted for review. Explicit approval to start the next stage authorizes a local commit of the previous stage alone. Do not push, publish, create public repositories, issues or PRs without specific authorization.
- Do not add tests, test frameworks, fixtures, CI or broad validation matrices unless the user requests them. Use the shortest real interaction path and necessary compilation checks.
- For JS/TS commodity utilities, consider suitable UnJS packages first, then other community packages. Official service SDKs and specialized drivers remain appropriate.
- Keep module-owned facts in their modules: Matrix owns messages, Hindsight owns memory, the knowledge service owns documents/indexes, Dock/native Harness owns execution. hutian stores business relationships and references.
- Runtime-private memory, knowledge, Skills and credentials are not scanned or synchronized. Rebinding a role does not replay or migrate an in-flight task.
- Use a separate PostgreSQL database and non-admin application role. Local workspace infrastructure is under ../infra/postgres; independent installs can supply their own PostgreSQL. Credentials, receipts, evidence and runtime logs stay under ignored .local/ with private permissions. Never print passwords or connection strings.
- The first stage is a trusted local single-creator workspace. Browser actions call the backend through a server-held token; do not move it to NEXT_PUBLIC variables or treat this as multi-user authentication.
- No production data reset, destructive migrations or automatic old-data migration. Use explicit versioned migrations, synchronize:false, and preserve stable role IDs independently of project membership.
