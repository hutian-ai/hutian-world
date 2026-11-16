import { EntitySchema } from "typeorm";
import {
  workspaceColumns,
  id,
  createdAt,
  updatedAt,
} from "../../../infrastructure/database/columns.js";
export interface RoleRecord {
  id: string;
  creatorId: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  description: string;
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
}
export const RoleSchema = new EntitySchema<RoleRecord>({
  name: "Role",
  tableName: "roles",
  columns: {
    id,
    ...workspaceColumns,
    creatorId: { type: "uuid", name: "creator_id" },
    name: { type: "varchar", length: 80 },
    description: { type: "varchar", length: 240 },
    instructions: { type: "text" },
    createdAt,
    updatedAt,
  },
});
