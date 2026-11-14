import { randomUUID } from "node:crypto";

type Sql = { query(sql: string, parameters?: any[]): Promise<any> };
/** Bootstrap is the only place where legacy creator configuration becomes an application identity. */
export async function ensureLocalIdentity(sql: Sql, creatorId: string) {
  await sql.query("INSERT INTO creators(id,display_name) VALUES($1,'我的工作台') ON CONFLICT DO NOTHING", [creatorId]);
  await sql.query("INSERT INTO app_users(id,creator_id,display_name) SELECT id,id,display_name FROM creators WHERE id=$1 ON CONFLICT (creator_id) DO NOTHING", [creatorId]);
  const [user] = await sql.query("SELECT id FROM app_users WHERE creator_id=$1", [creatorId]);
  await sql.query("INSERT INTO workspaces(id,owner_user_id,name,is_default,resource_namespace) VALUES($1,$2,'个人空间',true,$3) ON CONFLICT (owner_user_id) WHERE is_default DO NOTHING", [randomUUID(), user.id, creatorId]);
  const [workspace] = await sql.query("SELECT id FROM workspaces WHERE owner_user_id=$1 AND is_default", [user.id]);
  await sql.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'owner','active') ON CONFLICT DO NOTHING", [workspace.id, user.id]);
  for (const kind of ["matrix", "dock", "resources", "reports"]) {
    await sql.query("INSERT INTO module_connections(id,workspace_id,owner_user_id,kind) VALUES($1,$2,$3,$4) ON CONFLICT (workspace_id,owner_user_id,kind) DO NOTHING", [randomUUID(), workspace.id, user.id, kind]);
  }
}
