import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DataSource, In, type EntityManager } from "typeorm";
import { randomUUID } from "node:crypto";
import { AccessContexts } from "../access/access-context.service.js";
import type { ProjectInput } from "@hutian-world/contracts";
import { ProjectSchema } from "./entities/project.schema.js";
import { MembershipSchema } from "./entities/membership.schema.js";
import { RoleSchema } from "../roles/entities/role.schema.js";
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  private get scope() {
    return this.contexts.scope;
  }
  async createProject(input: ProjectInput) {
    const p = await this.db
      .getRepository(ProjectSchema)
      .save({ id: randomUUID(), ...this.scope, ...input });
    return { id: p.id };
  }
  async updateProject(id: string, input: ProjectInput) {
    const result = await this.db
      .getRepository(ProjectSchema)
      .update({ id, ...this.scope }, input);
    if (!result.affected) throw new NotFoundException("项目不存在或不可访问");
    return { id };
  }
  async membership(projectId: string, roleId: string, remove: boolean) {
    return this.db.transaction(async (manager) => {
      const project = await manager.getRepository(ProjectSchema).findOne({
        where: { id: projectId, ...this.scope },
        lock: { mode: "pessimistic_write" },
      });
      const role = await manager
        .getRepository(RoleSchema)
        .existsBy({ id: roleId, ...this.scope });
      if (!project || !role)
        throw new NotFoundException("项目或角色不存在，或不可访问");
      const repository = manager.getRepository(MembershipSchema);
      if (remove)
        await repository.delete({
          workspaceId: this.scope.workspaceId,
          projectId,
          roleId,
        });
      else
        await repository
          .createQueryBuilder()
          .insert()
          .values({ workspaceId: this.scope.workspaceId, projectId, roleId })
          .orIgnore()
          .execute();
      await manager
        .getRepository(ProjectSchema)
        .update({ id: projectId, ...this.scope }, { updatedAt: new Date() });
      return { projectId, roleId, removed: remove };
    });
  }
  async attachCreatedRole(
    projectId: string,
    roleId: string,
    manager: EntityManager,
  ) {
    await manager
      .getRepository(MembershipSchema)
      .insert({ workspaceId: this.scope.workspaceId, projectId, roleId });
    await manager
      .getRepository(ProjectSchema)
      .update({ id: projectId, ...this.scope }, { updatedAt: new Date() });
  }
  async requireProject(id: string, manager: EntityManager) {
    if (
      !(await manager
        .getRepository(ProjectSchema)
        .existsBy({ id, ...this.scope }))
    )
      throw new NotFoundException("项目不存在或不可访问");
  }
  async listMemberships() {
    // Membership projections retain both project and role ownership filters.
    const [projects, roles] = await Promise.all([
      this.db
        .getRepository(ProjectSchema)
        .find({ select: { id: true }, where: { ...this.scope } }),
      this.db
        .getRepository(RoleSchema)
        .find({ select: { id: true }, where: { ...this.scope } }),
    ]);
    return projects.length && roles.length
      ? this.db.getRepository(MembershipSchema).findBy({
          workspaceId: this.scope.workspaceId,
          projectId: In(projects.map((p) => p.id)),
          roleId: In(roles.map((r) => r.id)),
        })
      : [];
  }
  async list() {
    const [projects, memberships] = await Promise.all([
      this.db.getRepository(ProjectSchema).find({
        where: { ...this.scope },
        order: { updatedAt: "DESC", id: "ASC" },
      }),
      this.listMemberships(),
    ]);
    return projects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      roleIds: memberships
        .filter((m) => m.projectId === p.id)
        .map((m) => m.roleId),
    }));
  }
}
