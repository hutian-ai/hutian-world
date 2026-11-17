import { EntitySchema } from "typeorm";
import {
  createdAt,
  id,
  workspaceColumn,
} from "../../../infrastructure/database/columns.js";
export interface RoleChatRecord {
  workspaceId: string;
  roleId: string;
  agentId: string;
  userId: string;
  createdAt: Date;
}
export const RoleChatSchema = new EntitySchema<RoleChatRecord>({
  name: "RoleChatIdentity",
  tableName: "role_chat_identities",
  columns: {
    ...workspaceColumn,
    roleId: { ...id, name: "role_id" },
    agentId: { type: "varchar", length: 50, name: "agent_id", unique: true },
    userId: { type: "varchar", length: 500, name: "user_id", unique: true },
    createdAt,
  },
});
