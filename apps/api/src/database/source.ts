import "reflect-metadata";
import { DataSource } from "typeorm";
import { CreatorSchema, ProjectSchema, RoleSchema, MembershipSchema } from "./schema.js";
import { ProjectsAndRoles1793892000000 } from "./initial.js";

export function dataSource(url: string) {
  return new DataSource({
    type: "postgres", url, applicationName: "hutian-world", poolSize: 5,
    synchronize: false, migrationsRun: false, migrationsTransactionMode: "all",
    migrationsTableName: "hutian_world_migrations", migrations: [ProjectsAndRoles1793892000000],
    entities: [CreatorSchema, ProjectSchema, RoleSchema, MembershipSchema], logging: false,
    invalidWhereValuesBehavior: { null: "throw", undefined: "throw" },
  });
}
