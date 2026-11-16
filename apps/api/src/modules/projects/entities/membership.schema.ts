import { EntitySchema } from "typeorm";
import {
  workspaceColumn,
  id,
} from "../../../infrastructure/database/columns.js";
export interface MembershipRecord {
  workspaceId: string;
  projectId: string;
  roleId: string;
}
export const MembershipSchema = new EntitySchema<MembershipRecord>({
  name: "ProjectRole",
  tableName: "project_roles",
  columns: {
    ...workspaceColumn,
    projectId: { ...id, name: "project_id" },
    roleId: { ...id, name: "role_id" },
  },
});
