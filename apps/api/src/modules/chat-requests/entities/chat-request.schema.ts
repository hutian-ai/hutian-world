import type { ChatRequestInput } from "@hutian-world/contracts";
import { EntitySchema } from "typeorm";
export interface ChatRequestRow {
  id: string;
  workspace_id: string;
  requested_by_user_id: string;
  communication_connection_id: string;
  runtime_connection_id: string;
  snapshot: ChatRequestInput;
  state: string;
  run_id: string | null;
  reply_event_id: string | null;
  error: string | null;
  workflow_started: boolean;
  observe_attempts: number;
  next_observe_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
export const ChatRequestSchema = new EntitySchema<ChatRequestRow>({
  name: "ChatRequest",
  tableName: "chat_requests",
  columns: {
    id: { type: "uuid", primary: true },
    workspace_id: { type: "uuid" },
    requested_by_user_id: { type: "uuid" },
    communication_connection_id: { type: "uuid" },
    runtime_connection_id: { type: "uuid" },
    snapshot: { type: "jsonb" },
    state: { type: "varchar", length: 30, default: "accepted" },
    run_id: { type: "uuid", nullable: true },
    reply_event_id: { type: "text", nullable: true },
    error: { type: "text", nullable: true },
    observe_attempts: { type: "integer", default: 0 },
    next_observe_at: { type: "timestamptz", nullable: true },
    workflow_started: { type: "boolean", default: false },
    created_at: { type: "timestamptz", default: () => "now()" },
    updated_at: { type: "timestamptz", default: () => "now()" },
  },
});
