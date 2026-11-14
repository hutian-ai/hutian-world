import { EntitySchema } from "typeorm";

export interface CreatorRecord { id: string; displayName: string; createdAt: Date }
export interface ProjectRecord { id: string; creatorId: string; workspaceId: string; createdByUserId: string; name: string; goal: string; createdAt: Date; updatedAt: Date }
export interface RoleRecord { id: string; creatorId: string; workspaceId: string; createdByUserId: string; name: string; description: string; instructions: string; createdAt: Date; updatedAt: Date }
export interface MembershipRecord { workspaceId: string; projectId: string; roleId: string }
export interface RoleChatRecord { workspaceId: string; roleId: string; agentId: string; userId: string; createdAt: Date }
export interface RoleRuntimeRecord { workspaceId: string; roleId: string; nodeId: string; provider: string; label: string; updatedAt: Date }
const workspaceColumns = { workspaceId: { type: "uuid" as const, name: "workspace_id" }, createdByUserId: { type: "uuid" as const, name: "created_by_user_id" } };
const workspaceColumn = { workspaceId: { type: "uuid" as const, name: "workspace_id" } };
const id = { type: "uuid" as const, primary: true };
const createdAt = { type: "timestamptz" as const, createDate: true, name: "created_at" };
const updatedAt = { type: "timestamptz" as const, updateDate: true, name: "updated_at" };
export const CreatorSchema = new EntitySchema<CreatorRecord>({
  name: "Creator", tableName: "creators", columns: { id, displayName: { type: "text", name: "display_name" }, createdAt },
});
export const ProjectSchema = new EntitySchema<ProjectRecord>({
  name: "Project", tableName: "projects", columns: {
    id, ...workspaceColumns, creatorId: { type: "uuid", name: "creator_id" }, name: { type: "varchar", length: 80 }, goal: { type: "text" }, createdAt, updatedAt,
  },
});
export const RoleSchema = new EntitySchema<RoleRecord>({
  name: "Role", tableName: "roles", columns: {
    id, ...workspaceColumns, creatorId: { type: "uuid", name: "creator_id" }, name: { type: "varchar", length: 80 },
    description: { type: "varchar", length: 240 }, instructions: { type: "text" }, createdAt, updatedAt,
  },
});
export const MembershipSchema = new EntitySchema<MembershipRecord>({
  name: "ProjectRole", tableName: "project_roles", columns: {
    ...workspaceColumn, projectId: { ...id, name: "project_id" }, roleId: { ...id, name: "role_id" },
  },
});
export const RoleChatSchema = new EntitySchema<RoleChatRecord>({
  name: "RoleChatIdentity", tableName: "role_chat_identities", columns: {
    ...workspaceColumn, roleId: { ...id, name: "role_id" },
    agentId: { type: "varchar", length: 50, name: "agent_id", unique: true },
    userId: { type: "varchar", length: 500, name: "user_id", unique: true },
    createdAt,
  },
});
export const RoleRuntimeSchema = new EntitySchema<RoleRuntimeRecord>({
  name: "RoleRuntimeBinding", tableName: "role_runtime_bindings", columns: {
    ...workspaceColumn, roleId: { ...id, name: "role_id" },
    nodeId: { type: "uuid", name: "node_id" },
    provider: { type: "varchar", length: 128 },
    label: { type: "varchar", length: 200 },
    updatedAt,
  },
});
