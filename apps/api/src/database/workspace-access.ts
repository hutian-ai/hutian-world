import type { MigrationInterface, QueryRunner } from "typeorm";
import { ensureLocalIdentity } from "./local-identity.js";

export class WorkspaceAccess1794770000000 implements MigrationInterface {
  name = "WorkspaceAccess1794770000000";
  async up(sql: QueryRunner) {
    await sql.query(`
      CREATE TABLE app_users (
        id uuid PRIMARY KEY, creator_id uuid NOT NULL UNIQUE REFERENCES creators(id),
        display_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE workspaces (
        id uuid PRIMARY KEY, owner_user_id uuid NOT NULL REFERENCES app_users(id), name text NOT NULL,
        is_default boolean NOT NULL DEFAULT false, resource_namespace varchar(100) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX workspaces_owner_default ON workspaces(owner_user_id) WHERE is_default;
      CREATE TABLE workspace_members (
        workspace_id uuid NOT NULL REFERENCES workspaces(id), user_id uuid NOT NULL REFERENCES app_users(id),
        role varchar(10) NOT NULL CHECK (role IN ('owner','member')),
        status varchar(10) NOT NULL CHECK (status IN ('active','revoked')),
        PRIMARY KEY(workspace_id,user_id)
      );
      CREATE TABLE module_connections (
        id uuid PRIMARY KEY, workspace_id uuid NOT NULL, owner_user_id uuid NOT NULL,
        kind varchar(20) NOT NULL CHECK (kind IN ('matrix','dock','resources','reports')),
        UNIQUE(workspace_id,owner_user_id,kind), UNIQUE(workspace_id,id),
        FOREIGN KEY(workspace_id,owner_user_id) REFERENCES workspace_members(workspace_id,user_id)
      );
    `);
    const creators: { id: string }[] = await sql.query("SELECT id FROM creators");
    for (const creator of creators) await ensureLocalIdentity(sql, creator.id);
    for (const table of ["roles", "projects", "scheduled_tasks"]) {
      await sql.query(`ALTER TABLE ${table} ADD COLUMN workspace_id uuid REFERENCES workspaces(id), ADD COLUMN created_by_user_id uuid REFERENCES app_users(id)`);
      await sql.query(`UPDATE ${table} r SET workspace_id=w.id,created_by_user_id=u.id FROM app_users u JOIN workspaces w ON w.owner_user_id=u.id AND w.is_default WHERE u.creator_id=r.creator_id`);
      await sql.query(`ALTER TABLE ${table} ALTER COLUMN workspace_id SET NOT NULL, ALTER COLUMN created_by_user_id SET NOT NULL, ADD CONSTRAINT ${table}_workspace_identity UNIQUE(workspace_id,id), ADD CONSTRAINT ${table}_workspace_author FOREIGN KEY(workspace_id,created_by_user_id) REFERENCES workspace_members(workspace_id,user_id)`);
      await sql.query(`CREATE INDEX ${table}_workspace_owner ON ${table}(workspace_id,created_by_user_id)`);
    }
    for (const table of ["role_chat_identities", "role_runtime_bindings"]) {
      await sql.query(`ALTER TABLE ${table} ADD COLUMN workspace_id uuid`);
      await sql.query(`UPDATE ${table} b SET workspace_id=r.workspace_id FROM roles r WHERE r.id=b.role_id`);
      await sql.query(`ALTER TABLE ${table} ALTER COLUMN workspace_id SET NOT NULL, ADD CONSTRAINT ${table}_workspace_role FOREIGN KEY(workspace_id,role_id) REFERENCES roles(workspace_id,id)`);
    }
    await sql.query(`
      ALTER TABLE project_roles ADD COLUMN workspace_id uuid;
      UPDATE project_roles pr SET workspace_id=p.workspace_id FROM projects p WHERE p.id=pr.project_id;
      ALTER TABLE project_roles ALTER COLUMN workspace_id SET NOT NULL,
        ADD CONSTRAINT project_roles_workspace_project FOREIGN KEY(workspace_id,project_id) REFERENCES projects(workspace_id,id),
        ADD CONSTRAINT project_roles_workspace_role FOREIGN KEY(workspace_id,role_id) REFERENCES roles(workspace_id,id);
      ALTER TABLE scheduled_tasks ADD COLUMN run_as_user_id uuid, ADD COLUMN communication_connection_id uuid, ADD COLUMN runtime_connection_id uuid;
      UPDATE scheduled_tasks s SET run_as_user_id=s.created_by_user_id,communication_connection_id=m.id,runtime_connection_id=d.id
        FROM module_connections m, module_connections d WHERE m.workspace_id=s.workspace_id AND m.owner_user_id=s.created_by_user_id AND m.kind='matrix'
        AND d.workspace_id=s.workspace_id AND d.owner_user_id=s.created_by_user_id AND d.kind='dock';
      ALTER TABLE scheduled_tasks ALTER COLUMN run_as_user_id SET NOT NULL, ALTER COLUMN communication_connection_id SET NOT NULL, ALTER COLUMN runtime_connection_id SET NOT NULL,
        ADD CONSTRAINT scheduled_tasks_workspace_role FOREIGN KEY(workspace_id,role_id) REFERENCES roles(workspace_id,id),
        ADD CONSTRAINT scheduled_tasks_run_as FOREIGN KEY(workspace_id,run_as_user_id) REFERENCES workspace_members(workspace_id,user_id),
        ADD CONSTRAINT scheduled_tasks_matrix FOREIGN KEY(workspace_id,communication_connection_id) REFERENCES module_connections(workspace_id,id),
        ADD CONSTRAINT scheduled_tasks_dock FOREIGN KEY(workspace_id,runtime_connection_id) REFERENCES module_connections(workspace_id,id);
      ALTER TABLE scheduled_runs ADD COLUMN workspace_id uuid, ADD COLUMN requested_by_user_id uuid REFERENCES app_users(id), ADD COLUMN run_as_user_id uuid,
        ADD COLUMN communication_connection_id uuid, ADD COLUMN runtime_connection_id uuid;
      UPDATE scheduled_runs r SET workspace_id=s.workspace_id,requested_by_user_id=s.created_by_user_id,run_as_user_id=s.run_as_user_id,
        communication_connection_id=s.communication_connection_id,runtime_connection_id=s.runtime_connection_id FROM scheduled_tasks s WHERE s.id=r.schedule_id;
      ALTER TABLE scheduled_runs ALTER COLUMN workspace_id SET NOT NULL, ALTER COLUMN requested_by_user_id SET NOT NULL, ALTER COLUMN run_as_user_id SET NOT NULL,
        ALTER COLUMN communication_connection_id SET NOT NULL, ALTER COLUMN runtime_connection_id SET NOT NULL,
        ADD CONSTRAINT scheduled_runs_workspace_task FOREIGN KEY(workspace_id,schedule_id) REFERENCES scheduled_tasks(workspace_id,id),
        ADD CONSTRAINT scheduled_runs_run_as FOREIGN KEY(workspace_id,run_as_user_id) REFERENCES workspace_members(workspace_id,user_id),
        ADD CONSTRAINT scheduled_runs_matrix FOREIGN KEY(workspace_id,communication_connection_id) REFERENCES module_connections(workspace_id,id),
        ADD CONSTRAINT scheduled_runs_dock FOREIGN KEY(workspace_id,runtime_connection_id) REFERENCES module_connections(workspace_id,id);
    `);
  }
  async down() { throw new Error("空间归属和身份映射必须保留，请先备份并人工核对。"); }
}
