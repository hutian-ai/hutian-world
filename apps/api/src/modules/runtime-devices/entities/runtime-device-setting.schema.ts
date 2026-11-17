import { EntitySchema } from "typeorm";
export interface RuntimeDeviceSetting {
  workspaceId: string;
  connectionId: string;
  sourceKey: string;
  nodeId: string;
  customName: string | null;
  version: number;
  updatedBy: string;
  updatedAt: Date;
}
export const RuntimeDeviceSettingSchema =
  new EntitySchema<RuntimeDeviceSetting>({
    name: "RuntimeDeviceSetting",
    tableName: "runtime_device_settings",
    columns: {
      workspaceId: { type: "uuid", name: "workspace_id", primary: true },
      connectionId: { type: "uuid", name: "connection_id", primary: true },
      sourceKey: {
        type: "varchar",
        length: 64,
        name: "source_key",
        primary: true,
      },
      nodeId: { type: "uuid", name: "node_id", primary: true },
      customName: {
        type: "varchar",
        length: 80,
        name: "custom_name",
        nullable: true,
      },
      version: { type: "integer" },
      updatedBy: { type: "uuid", name: "updated_by" },
      updatedAt: { type: "timestamptz", name: "updated_at", updateDate: true },
    },
  });
