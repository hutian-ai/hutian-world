import { EntitySchema } from "typeorm";
import { id, createdAt } from "../../../infrastructure/database/columns.js";
export interface CreatorRecord {
  id: string;
  displayName: string;
  createdAt: Date;
}
export const CreatorSchema = new EntitySchema<CreatorRecord>({
  name: "Creator",
  tableName: "creators",
  columns: {
    id,
    displayName: { type: "text", name: "display_name" },
    createdAt,
  },
});
