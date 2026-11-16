import { EntitySchema } from "typeorm";
import type { ExecutionPreferences } from "@hutian-world/contracts";
import {
  workspaceColumn,
  id,
  updatedAt,
} from "../../../infrastructure/database/columns.js";
export interface RoleRuntimeRecord {
  workspaceId: string;
  roleId: string;
  nodeId: string;
  provider: string;
  label: string;
  preferences: ExecutionPreferences;
  updatedAt: Date;
}
export const RoleRuntimeSchema = new EntitySchema<RoleRuntimeRecord>({
  name: "RoleRuntimeBinding",
  tableName: "role_runtime_bindings",
  columns: {
    ...workspaceColumn,
    roleId: { ...id, name: "role_id" },
    nodeId: { type: "uuid", name: "node_id" },
    provider: { type: "varchar", length: 128 },
    label: { type: "varchar", length: 200 },
    preferences: { type: "jsonb", default: () => "'{}'::jsonb" },
    updatedAt,
  },
});
