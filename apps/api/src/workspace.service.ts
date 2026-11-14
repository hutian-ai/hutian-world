import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, In } from "typeorm";
import { randomUUID } from "node:crypto";
import type { Workspace, ProjectInput, RoleInput, CreateRoleInput, RoleChatIdentity, RoleRuntimeBindingInput } from "@hutian-world/contracts";
import { CreatorSchema, ProjectSchema, RoleSchema, MembershipSchema, RoleChatSchema, RoleRuntimeSchema } from "./database/schema.js";
import type { Environment } from "./environment.js";

@Injectable()
export class WorkspaceService {
  constructor(@Inject(DataSource) private readonly db: DataSource, @Inject("ENV") private readonly env: Environment) {}
  private get creatorId() { return this.env.HUTIAN_CREATOR_ID; }

  async overview(): Promise<Workspace> {
    const [creator, projects, roles] = await Promise.all([
      this.db.getRepository(CreatorSchema).findOneByOrFail({ id: this.creatorId }),
      this.db.getRepository(ProjectSchema).find({ where: { creatorId: this.creatorId }, order: { updatedAt: "DESC", id: "ASC" } }),
      this.db.getRepository(RoleSchema).find({ where: { creatorId: this.creatorId }, order: { updatedAt: "DESC", id: "ASC" } }),
    ]);
    const memberships = projects.length && roles.length ? await this.db.getRepository(MembershipSchema).findBy({
      projectId: In(projects.map(p => p.id)), roleId: In(roles.map(r => r.id)),
    }) : [];
    const [chatIdentities, runtimeBindings] = roles.length ? await Promise.all([
      this.db.getRepository(RoleChatSchema).findBy({ roleId: In(roles.map(r => r.id)) }),
      this.db.getRepository(RoleRuntimeSchema).findBy({ roleId: In(roles.map(r => r.id)) }),
    ]) : [[], []];
    return {
      creator: { id: creator.id, displayName: creator.displayName },
      projects: projects.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), roleIds: memberships.filter(m => m.projectId === p.id).map(m => m.roleId) })),
      roles: roles.map(r => {
        const chat = chatIdentities.find(c => c.roleId === r.id);
        const runtime = runtimeBindings.find(b => b.roleId === r.id);
        return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
          projectIds: memberships.filter(m => m.roleId === r.id).map(m => m.projectId),
          chatIdentity: chat ? { agentId: chat.agentId, userId: chat.userId } : null,
          runtimeBinding: runtime ? { nodeId: runtime.nodeId, provider: runtime.provider, label: runtime.label, updatedAt: runtime.updatedAt.toISOString() } : null };
      }),
    };
  }
  async createProject(input: ProjectInput) {
    const p = await this.db.getRepository(ProjectSchema).save({ id: randomUUID(), creatorId: this.creatorId, ...input });
    return { id: p.id };
  }
  async updateProject(id: string, input: ProjectInput) {
    const result = await this.db.getRepository(ProjectSchema).update({ id, creatorId: this.creatorId }, input);
    if (!result.affected) throw new NotFoundException("项目不存在或不可访问");
    return { id };
  }
  async createRole({ projectId, ...input }: CreateRoleInput) {
    return this.db.transaction(async manager => {
      if (projectId && !await manager.getRepository(ProjectSchema).existsBy({ id: projectId, creatorId: this.creatorId }))
        throw new NotFoundException("项目不存在或不可访问");
      const role = await manager.getRepository(RoleSchema).save({ id: randomUUID(), creatorId: this.creatorId, ...input });
      if (projectId) {
        await manager.getRepository(MembershipSchema).insert({ projectId, roleId: role.id });
        await manager.getRepository(ProjectSchema).update({ id: projectId }, { updatedAt: new Date() });
      }
      return { id: role.id };
    });
  }
  async updateRole(id: string, input: RoleInput) {
    const result = await this.db.getRepository(RoleSchema).update({ id, creatorId: this.creatorId }, input);
    if (!result.affected) throw new NotFoundException("角色不存在或不可访问");
    return { id };
  }
  async bindRoleChat(id: string, input: RoleChatIdentity) {
    return this.db.transaction(async manager => {
      const role = await manager.getRepository(RoleSchema).findOne({
        where: { id, creatorId: this.creatorId }, lock: { mode: "pessimistic_write" },
      });
      if (!role) throw new NotFoundException("角色不存在或不可访问");
      const repository = manager.getRepository(RoleChatSchema);
      const existing = await repository.findOneBy({ roleId: id });
      if (existing) {
        if (existing.agentId !== input.agentId || existing.userId !== input.userId)
          throw new ConflictException("角色已有通信身份，请先核对原关联。");
        return { id };
      }
      if (await repository.existsBy([{ agentId: input.agentId }, { userId: input.userId }]))
        throw new ConflictException("这个通信身份已经属于其他角色。");
      await repository.insert({ roleId: id, ...input });
      return { id };
    });
  }
  async setRoleRuntime(id: string, input: RoleRuntimeBindingInput) {
    return this.db.transaction(async manager => {
      const role = await manager.getRepository(RoleSchema).findOne({
        where: { id, creatorId: this.creatorId }, lock: { mode: "pessimistic_write" },
      });
      if (!role) throw new NotFoundException("角色不存在或不可访问");
      const repository = manager.getRepository(RoleRuntimeSchema);
      const current = await repository.findOneBy({ roleId: id });
      if ((!current && !input.runtime) || (current && input.runtime && current.nodeId === input.runtime.nodeId && current.provider === input.runtime.provider)) return { id };
      if ((current?.updatedAt.toISOString() ?? null) !== input.expectedUpdatedAt)
        throw new ConflictException("执行配置已在其他页面变更，请重新读取后再保存。");
      if (input.runtime) await repository.upsert({ roleId: id, ...input.runtime, updatedAt: new Date() }, ["roleId"]);
      else await repository.delete({ roleId: id });
      return { id };
    });
  }
  async membership(projectId: string, roleId: string, remove: boolean) {
    return this.db.transaction(async manager => {
      const project = await manager.getRepository(ProjectSchema).findOne({ where: { id: projectId, creatorId: this.creatorId }, lock: { mode: "pessimistic_write" } });
      const role = await manager.getRepository(RoleSchema).existsBy({ id: roleId, creatorId: this.creatorId });
      if (!project || !role) throw new NotFoundException("项目或角色不存在，或不可访问");
      const repository = manager.getRepository(MembershipSchema);
      if (remove) await repository.delete({ projectId, roleId });
      else await repository.createQueryBuilder().insert().values({ projectId, roleId }).orIgnore().execute();
      await manager.getRepository(ProjectSchema).update({ id: projectId }, { updatedAt: new Date() });
      return { projectId, roleId, removed: remove };
    });
  }
}
