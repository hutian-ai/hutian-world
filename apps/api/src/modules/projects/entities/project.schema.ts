import { EntitySchema } from "typeorm";
import {
  workspaceColumns,
  id,
  createdAt,
  updatedAt,
} from "../../../infrastructure/database/columns.js";
export interface ProjectRecord {
  id: string;
  creatorId: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  goal: string;
  createdAt: Date;
  updatedAt: Date;
}
export const ProjectSchema = new EntitySchema<ProjectRecord>({
  name: "Project",
  tableName: "projects",
  columns: {
    id,
    ...workspaceColumns,
    creatorId: { type: "uuid", name: "creator_id" },
    name: { type: "varchar", length: 80 },
    goal: { type: "text" },
    createdAt,
    updatedAt,
  },
});
