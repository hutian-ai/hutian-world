import type { MigrationInterface, QueryRunner } from "typeorm";

export class ProjectsAndRoles1793892000000 implements MigrationInterface {
  name = "ProjectsAndRoles1793892000000";
  async up(query: QueryRunner) {
    await query.query(`
      CREATE TABLE creators (
        id uuid PRIMARY KEY, display_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE projects (
        id uuid PRIMARY KEY, creator_id uuid NOT NULL REFERENCES creators(id),
        name varchar(80) NOT NULL CHECK (length(trim(name)) > 0), goal text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX projects_creator_idx ON projects(creator_id, updated_at DESC);
      CREATE TABLE roles (
        id uuid PRIMARY KEY, creator_id uuid NOT NULL REFERENCES creators(id),
        name varchar(80) NOT NULL CHECK (length(trim(name)) > 0), description varchar(240) NOT NULL DEFAULT '',
        instructions text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX roles_creator_idx ON roles(creator_id, updated_at DESC);
      CREATE TABLE project_roles (
        project_id uuid NOT NULL REFERENCES projects(id), role_id uuid NOT NULL REFERENCES roles(id),
        PRIMARY KEY(project_id, role_id)
      );
      CREATE INDEX project_roles_role_idx ON project_roles(role_id);
    `);
  }
  async down() { throw new Error("本地数据迁移不提供自动删除，请先备份并人工核对。"); }
}
