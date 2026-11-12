import { z } from "zod";

const name = z.string().trim().min(1, "请填写名称").max(80, "名称最多 80 个字符");
export const projectInput = z.object({
  name,
  goal: z.string().trim().max(12000, "项目目标最多 12000 个字符"),
}).strict();
export const roleInput = z.object({
  name,
  description: z.string().trim().max(240, "职责简介最多 240 个字符"),
  instructions: z.string().trim().max(20000, "角色设定最多 20000 个字符"),
}).strict();
export const createRoleInput = roleInput.extend({ projectId: z.uuid().optional() });
export type ProjectInput = z.infer<typeof projectInput>;
export type RoleInput = z.infer<typeof roleInput>;
export type CreateRoleInput = z.infer<typeof createRoleInput>;
export interface Project {
  id: string;
  creatorId: string;
  name: string;
  goal: string;
  createdAt: string;
  updatedAt: string;
  roleIds: string[];
}
export interface Role {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
  projectIds: string[];
}
export interface Workspace {
  creator: { id: string; displayName: string };
  projects: Project[];
  roles: Role[];
}
