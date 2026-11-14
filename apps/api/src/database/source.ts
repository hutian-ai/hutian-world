import "reflect-metadata";
import { DataSource } from "typeorm";
import { CreatorSchema, ProjectSchema, RoleSchema, MembershipSchema, RoleChatSchema, RoleRuntimeSchema } from "./schema.js";
import { ProjectsAndRoles1793892000000 } from "./initial.js";
import { RoleChatIdentity1794531600000 } from "./role-chat.js";
import { RoleRuntimeBinding1794535200000 } from "./role-runtime.js";

export function dataSource(url: string) {
  return new DataSource({
    type: "postgres", url, applicationName: "hutian-world", poolSize: 5,
    synchronize: false, migrationsRun: false, migrationsTransactionMode: "all",
    migrationsTableName: "hutian_world_migrations", migrations: [ProjectsAndRoles1793892000000, RoleChatIdentity1794531600000, RoleRuntimeBinding1794535200000],
    entities: [CreatorSchema, ProjectSchema, RoleSchema, MembershipSchema, RoleChatSchema, RoleRuntimeSchema], logging: false,
    invalidWhereValuesBehavior: { null: "throw", undefined: "throw" },
  });
}
