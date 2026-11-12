import { EntitySchema } from "typeorm";

export interface CreatorRecord { id: string; displayName: string; createdAt: Date }
export interface ProjectRecord { id: string; creatorId: string; name: string; goal: string; createdAt: Date; updatedAt: Date }
export interface RoleRecord { id: string; creatorId: string; name: string; description: string; instructions: string; createdAt: Date; updatedAt: Date }
export interface MembershipRecord { projectId: string; roleId: string }
const id = { type: "uuid" as const, primary: true };
const createdAt = { type: "timestamptz" as const, createDate: true, name: "created_at" };
const updatedAt = { type: "timestamptz" as const, updateDate: true, name: "updated_at" };
export const CreatorSchema = new EntitySchema<CreatorRecord>({
  name: "Creator", tableName: "creators", columns: { id, displayName: { type: "text", name: "display_name" }, createdAt },
});
export const ProjectSchema = new EntitySchema<ProjectRecord>({
  name: "Project", tableName: "projects", columns: {
    id, creatorId: { type: "uuid", name: "creator_id" }, name: { type: "varchar", length: 80 }, goal: { type: "text" }, createdAt, updatedAt,
  },
});
export const RoleSchema = new EntitySchema<RoleRecord>({
  name: "Role", tableName: "roles", columns: {
    id, creatorId: { type: "uuid", name: "creator_id" }, name: { type: "varchar", length: 80 },
    description: { type: "varchar", length: 240 }, instructions: { type: "text" }, createdAt, updatedAt,
  },
});
export const MembershipSchema = new EntitySchema<MembershipRecord>({
  name: "ProjectRole", tableName: "project_roles", columns: {
    projectId: { ...id, name: "project_id" }, roleId: { ...id, name: "role_id" },
  },
});
