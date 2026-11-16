import { AsyncLocalStorage } from "node:async_hooks";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  accessContext,
  type AccessContext,
  type RunAuthority,
} from "@hutian-world/contracts";
import type { Environment } from "../../config/environment.js";

import { ensureLocalIdentity } from "./local-identity.js";
import { CreatorSchema } from "./entities/creator.schema.js";
import {
  AppUserSchema,
  WorkspaceSchema,
  WorkspaceMemberSchema,
  ModuleConnectionSchema,
} from "./entities/access.schema.js";

@Injectable()
export class AccessContexts {
  private readonly storage = new AsyncLocalStorage<AccessContext>();
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject("ENV") private readonly env: Environment,
  ) {}
  async onModuleInit() {
    await this.db.transaction((manager) =>
      ensureLocalIdentity(manager, this.env.HUTIAN_CREATOR_ID),
    );
  }
  creator() {
    return this.db
      .getRepository(CreatorSchema)
      .findOneByOrFail({ id: this.current().creatorId });
  }
  get scope() {
    const c = this.current();
    return {
      workspaceId: c.workspaceId,
      createdByUserId: c.userId,
      creatorId: c.creatorId,
    };
  }
  current() {
    const context = this.storage.getStore();
    if (!context) throw new ForbiddenException("缺少服务端身份与空间范围");
    return context;
  }
  run<T>(context: AccessContext, callback: () => T) {
    return this.storage.run(context, callback);
  }
  /** Only the local identity adapter reads the legacy environment setting. No browser-selected identity is accepted. */
  async local(): Promise<AccessContext> {
    const user = await this.db
      .getRepository(AppUserSchema)
      .findOneBy({ creatorId: this.env.HUTIAN_CREATOR_ID });
    const workspace =
      user &&
      (await this.db
        .getRepository(WorkspaceSchema)
        .findOneBy({ ownerUserId: user.id, isDefault: true }));
    const member =
      workspace &&
      user &&
      (await this.db.getRepository(WorkspaceMemberSchema).findOneBy({
        workspaceId: workspace.id,
        userId: user.id,
        status: "active",
        role: "owner",
      }));
    if (!user || !workspace || !member)
      throw new ForbiddenException("当前本机身份不属于可用的空间");
    const rows = await this.db
      .getRepository(ModuleConnectionSchema)
      .findBy({ workspaceId: workspace.id, ownerUserId: user.id });
    return accessContext.parse({
      userId: user.id,
      creatorId: user.creatorId,
      workspaceId: workspace.id,
      resourceNamespace: workspace.resourceNamespace,
      membershipRole: member.role,
      identitySource: "local-owner",
      connections: Object.fromEntries(
        rows.map((connection) => [connection.kind, connection.id]),
      ),
    });
  }
  async authorizeRun(authority: RunAuthority) {
    const current = this.current();
    if (
      authority.workspaceId !== current.workspaceId ||
      authority.runAsUserId !== current.userId ||
      authority.requestedByUserId !== current.userId ||
      authority.communicationConnectionId !== current.connections.matrix ||
      authority.runtimeConnectionId !== current.connections.dock
    )
      throw new ForbiddenException(
        "原运行的执行身份或连接不属于当前空间，未替换为默认连接",
      );
    const member = await this.db.getRepository(WorkspaceMemberSchema).existsBy({
      workspaceId: authority.workspaceId,
      userId: authority.runAsUserId,
      status: "active",
    });
    if (!member) throw new ForbiddenException("原运行的执行身份已不可用");
  }
}
