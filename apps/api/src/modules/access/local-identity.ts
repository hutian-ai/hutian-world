import { randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";
import {
  AppUserSchema,
  ModuleConnectionSchema,
  WorkspaceMemberSchema,
  WorkspaceSchema,
} from "./entities/access.schema.js";
import { CreatorSchema } from "./entities/creator.schema.js";
/** Bootstrap preserves existing identities and never restores revoked membership. */
export async function ensureLocalIdentity(
  manager: EntityManager,
  creatorId: string,
) {
  await manager
    .createQueryBuilder()
    .insert()
    .into(CreatorSchema)
    .values({ id: creatorId, displayName: "我的工作台" })
    .orIgnore()
    .execute();
  const creator = await manager
    .getRepository(CreatorSchema)
    .findOneByOrFail({ id: creatorId });
  await manager
    .createQueryBuilder()
    .insert()
    .into(AppUserSchema)
    .values({ id: creator.id, creatorId, displayName: creator.displayName })
    .orIgnore()
    .execute();
  const user = await manager
    .getRepository(AppUserSchema)
    .findOneByOrFail({ creatorId });
  await manager
    .createQueryBuilder()
    .insert()
    .into(WorkspaceSchema)
    .values({
      id: randomUUID(),
      ownerUserId: user.id,
      name: "个人空间",
      isDefault: true,
      resourceNamespace: creatorId,
    })
    .orIgnore()
    .execute();
  const workspace = await manager
    .getRepository(WorkspaceSchema)
    .findOneByOrFail({ ownerUserId: user.id, isDefault: true });
  await manager
    .createQueryBuilder()
    .insert()
    .into(WorkspaceMemberSchema)
    .values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
      status: "active",
    })
    .orIgnore()
    .execute();
  for (const kind of ["matrix", "dock", "resources", "reports"] as const) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(ModuleConnectionSchema)
      .values({
        id: randomUUID(),
        workspaceId: workspace.id,
        ownerUserId: user.id,
        kind,
      })
      .orIgnore()
      .execute();
  }
}
