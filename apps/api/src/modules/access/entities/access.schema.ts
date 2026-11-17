import { EntitySchema } from "typeorm";
import { createdAt, id } from "../../../infrastructure/database/columns.js";
export interface AppUserRecord {
  id: string;
  creatorId: string;
  displayName: string;
  createdAt: Date;
}
export interface WorkspaceRecord {
  id: string;
  ownerUserId: string;
  name: string;
  isDefault: boolean;
  resourceNamespace: string;
  createdAt: Date;
}
export interface WorkspaceMemberRecord {
  workspaceId: string;
  userId: string;
  role: "owner" | "member";
  status: "active" | "revoked";
}
export interface ModuleConnectionRecord {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  kind: "matrix" | "dock" | "resources" | "reports";
}
export const AppUserSchema = new EntitySchema<AppUserRecord>({
  name: "AppUser",
  tableName: "app_users",
  columns: {
    id,
    creatorId: { type: "uuid", name: "creator_id", unique: true },
    displayName: { type: "text", name: "display_name" },
    createdAt,
  },
});
export const WorkspaceSchema = new EntitySchema<WorkspaceRecord>({
  name: "Workspace",
  tableName: "workspaces",
  columns: {
    id,
    ownerUserId: { type: "uuid", name: "owner_user_id" },
    name: { type: "text" },
    isDefault: { type: "boolean", name: "is_default", default: false },
    resourceNamespace: {
      type: "varchar",
      length: 100,
      name: "resource_namespace",
      unique: true,
    },
    createdAt,
  },
});
export const WorkspaceMemberSchema = new EntitySchema<WorkspaceMemberRecord>({
  name: "WorkspaceMember",
  tableName: "workspace_members",
  columns: {
    workspaceId: { type: "uuid", name: "workspace_id", primary: true },
    userId: { type: "uuid", name: "user_id", primary: true },
    role: { type: "varchar", length: 10 },
    status: { type: "varchar", length: 10 },
  },
});
export const ModuleConnectionSchema = new EntitySchema<ModuleConnectionRecord>({
  name: "ModuleConnection",
  tableName: "module_connections",
  columns: {
    id,
    workspaceId: { type: "uuid", name: "workspace_id" },
    ownerUserId: { type: "uuid", name: "owner_user_id" },
    kind: { type: "varchar", length: 20 },
  },
  uniques: [
    { columns: ["workspaceId", "ownerUserId", "kind"] },
    { columns: ["workspaceId", "id"] },
  ],
});
