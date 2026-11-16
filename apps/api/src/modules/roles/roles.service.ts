import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource, In } from "typeorm";
import { randomUUID } from "node:crypto";
import { AccessContexts } from "../access/access-context.service.js";
import type {
  RoleInput,
  CreateRoleInput,
  RoleChatIdentity,
  RoleRuntimeBindingInput,
} from "@hutian-world/contracts";
import { RoleSchema } from "./entities/role.schema.js";
import { RoleChatSchema } from "./entities/role-chat.schema.js";
import { RoleRuntimeSchema } from "./entities/role-runtime.schema.js";
import { ProjectsService } from "../projects/projects.service.js";
@Injectable()
export class RolesService {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}
  private get scope() {
    return this.contexts.scope;
  }
  async createRole({ projectId, ...input }: CreateRoleInput) {
    return this.db.transaction(async (manager) => {
      if (projectId) await this.projects.requireProject(projectId, manager);
      const role = await manager
        .getRepository(RoleSchema)
        .save({ id: randomUUID(), ...this.scope, ...input });
      if (projectId)
        await this.projects.attachCreatedRole(projectId, role.id, manager);
      return { id: role.id };
    });
  }
  async updateRole(id: string, input: RoleInput) {
    const result = await this.db
      .getRepository(RoleSchema)
      .update({ id, ...this.scope }, input);
    if (!result.affected) throw new NotFoundException("角色不存在或不可访问");
    return { id };
  }
  async bindRoleChat(id: string, input: RoleChatIdentity) {
    return this.db.transaction(async (manager) => {
      const role = await manager.getRepository(RoleSchema).findOne({
        where: { id, ...this.scope },
        lock: { mode: "pessimistic_write" },
      });
      if (!role) throw new NotFoundException("角色不存在或不可访问");
      const repository = manager.getRepository(RoleChatSchema);
      const existing = await repository.findOneBy({
        workspaceId: this.scope.workspaceId,
        roleId: id,
      });
      if (existing) {
        if (
          existing.agentId !== input.agentId ||
          existing.userId !== input.userId
        )
          throw new ConflictException("角色已有通信身份，请先核对原关联。");
        return { id };
      }
      if (
        await repository.existsBy([
          { agentId: input.agentId },
          { userId: input.userId },
        ])
      )
        throw new ConflictException("这个通信身份已经属于其他角色。");
      await repository.insert({
        workspaceId: this.scope.workspaceId,
        roleId: id,
        ...input,
      });
      return { id };
    });
  }
  async setRoleRuntime(id: string, input: RoleRuntimeBindingInput) {
    return this.db.transaction(async (manager) => {
      const role = await manager.getRepository(RoleSchema).findOne({
        where: { id, ...this.scope },
        lock: { mode: "pessimistic_write" },
      });
      if (!role) throw new NotFoundException("角色不存在或不可访问");
      const repository = manager.getRepository(RoleRuntimeSchema);
      const current = await repository.findOneBy({
        workspaceId: this.scope.workspaceId,
        roleId: id,
      });
      if (
        (current?.updatedAt.toISOString() ?? null) !== input.expectedUpdatedAt
      )
        throw new ConflictException(
          "执行配置已在其他页面变更，请重新读取后再保存。",
        );
      if (input.runtime)
        await repository.upsert(
          {
            workspaceId: this.scope.workspaceId,
            roleId: id,
            ...input.runtime,
            updatedAt: new Date(),
          },
          ["roleId"],
        );
      else
        await repository.delete({
          workspaceId: this.scope.workspaceId,
          roleId: id,
        });
      const saved = await repository.findOneBy({
        workspaceId: this.scope.workspaceId,
        roleId: id,
      });
      return {
        id,
        binding: saved
          ? {
              nodeId: saved.nodeId,
              provider: saved.provider,
              label: saved.label,
              preferences: saved.preferences,
              updatedAt: saved.updatedAt.toISOString(),
            }
          : null,
      };
    });
  }
  async list() {
    const roles = await this.db.getRepository(RoleSchema).find({
      where: { ...this.scope },
      order: { updatedAt: "DESC", id: "ASC" },
    });
    const memberships = await this.projects.listMemberships();
    const [chatIdentities, runtimeBindings] = roles.length
      ? await Promise.all([
          this.db.getRepository(RoleChatSchema).findBy({
            workspaceId: this.scope.workspaceId,
            roleId: In(roles.map((r) => r.id)),
          }),
          this.db.getRepository(RoleRuntimeSchema).findBy({
            workspaceId: this.scope.workspaceId,
            roleId: In(roles.map((r) => r.id)),
          }),
        ])
      : [[], []];
    return roles.map((r) => {
      const chat = chatIdentities.find((c) => c.roleId === r.id);
      const runtime = runtimeBindings.find((b) => b.roleId === r.id);
      return {
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        projectIds: memberships
          .filter((m) => m.roleId === r.id)
          .map((m) => m.projectId),
        chatIdentity: chat
          ? { agentId: chat.agentId, userId: chat.userId }
          : null,
        runtimeBinding: runtime
          ? {
              nodeId: runtime.nodeId,
              provider: runtime.provider,
              label: runtime.label,
              preferences: runtime.preferences,
              updatedAt: runtime.updatedAt.toISOString(),
            }
          : null,
      };
    });
  }
}
