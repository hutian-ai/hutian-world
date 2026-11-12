import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, In } from "typeorm";
import { randomUUID } from "node:crypto";
import type { Workspace, ProjectInput, RoleInput, CreateRoleInput } from "@hutian-world/contracts";
import { CreatorSchema, ProjectSchema, RoleSchema, MembershipSchema } from "./database/schema.js";
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
    return {
      creator: { id: creator.id, displayName: creator.displayName },
      projects: projects.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), roleIds: memberships.filter(m => m.projectId === p.id).map(m => m.roleId) })),
      roles: roles.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), projectIds: memberships.filter(m => m.roleId === r.id).map(m => m.projectId) })),
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
