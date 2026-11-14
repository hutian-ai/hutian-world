import { AsyncLocalStorage } from "node:async_hooks";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { DataSource } from "typeorm";
import { accessContext, type AccessContext, type RunAuthority } from "@hutian-world/contracts";
import type { Environment } from "./environment.js";

@Injectable()
export class AccessContexts {
  private readonly storage = new AsyncLocalStorage<AccessContext>();
  constructor(@Inject(DataSource) private readonly db: DataSource, @Inject("ENV") private readonly env: Environment) {}
  current() {
    const context = this.storage.getStore();
    if (!context) throw new ForbiddenException("缺少服务端身份与空间范围");
    return context;
  }
  run<T>(context: AccessContext, callback: () => T) { return this.storage.run(context, callback); }
  /** Only the local identity adapter reads the legacy environment setting. No browser-selected identity is accepted. */
  async local(): Promise<AccessContext> {
    const [row] = await this.db.query(`SELECT u.id AS user_id,u.creator_id,w.id AS workspace_id,w.resource_namespace,m.role
      FROM app_users u JOIN workspaces w ON w.owner_user_id=u.id AND w.is_default
      JOIN workspace_members m ON m.workspace_id=w.id AND m.user_id=u.id AND m.status='active' AND m.role='owner'
      WHERE u.creator_id=$1`, [this.env.HUTIAN_CREATOR_ID]);
    if (!row) throw new ForbiddenException("当前本机身份不属于可用的空间");
    const rows: { id: string; kind: string }[] = await this.db.query("SELECT id,kind FROM module_connections WHERE workspace_id=$1 AND owner_user_id=$2", [row.workspace_id, row.user_id]);
    return accessContext.parse({ userId: row.user_id, creatorId: row.creator_id, workspaceId: row.workspace_id, resourceNamespace: row.resource_namespace,
      membershipRole: row.role, identitySource: "local-owner", connections: Object.fromEntries(rows.map(connection => [connection.kind, connection.id])) });
  }
  async authorizeRun(authority: RunAuthority) {
    const current = this.current();
    if (authority.workspaceId !== current.workspaceId || authority.runAsUserId !== current.userId || authority.requestedByUserId !== current.userId ||
      authority.communicationConnectionId !== current.connections.matrix || authority.runtimeConnectionId !== current.connections.dock)
      throw new ForbiddenException("原运行的执行身份或连接不属于当前空间，未替换为默认连接");
    const [member] = await this.db.query("SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND status='active'", [authority.workspaceId, authority.runAsUserId]);
    if (!member) throw new ForbiddenException("原运行的执行身份已不可用");
  }
}

@Injectable()
export class AccessContextInterceptor implements NestInterceptor {
  constructor(@Inject(AccessContexts) private readonly contexts: AccessContexts) {}
  intercept(execution: ExecutionContext, next: CallHandler) {
    const context = execution.switchToHttp().getRequest<{ hutianAccess: AccessContext }>().hutianAccess;
    return new Observable(subscriber => this.contexts.run(context, () => {
      const subscription = next.handle().subscribe(subscriber);
      return () => subscription.unsubscribe();
    }));
  }
}
