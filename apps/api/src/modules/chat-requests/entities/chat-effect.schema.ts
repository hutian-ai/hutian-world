import { EntitySchema } from "typeorm";
export interface ChatEffectRow {
  requestId: string;
  workspaceId: string;
  replyEventId: string;
  state: "pending" | "completed" | "attention";
  attempts: number;
  generation: number;
  errorCode: number | null;
  nextAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
export const ChatEffectSchema = new EntitySchema<ChatEffectRow>({
  name: "ChatEffect",
  tableName: "chat_effects",
  columns: {
    requestId: { name: "request_id", type: "uuid", primary: true },
    workspaceId: { name: "workspace_id", type: "uuid" },
    replyEventId: { name: "reply_event_id", type: "text" },
    state: { type: "varchar", length: 20, default: "pending" },
    generation: { type: "integer", default: 0 },
    attempts: { type: "integer", default: 0 },
    errorCode: { name: "error_code", type: "integer", nullable: true },
    nextAttemptAt: {
      name: "next_attempt_at",
      type: "timestamptz",
      default: () => "now()",
    },
    createdAt: {
      name: "created_at",
      type: "timestamptz",
      default: () => "now()",
    },
    updatedAt: {
      name: "updated_at",
      type: "timestamptz",
      default: () => "now()",
    },
  },
});
