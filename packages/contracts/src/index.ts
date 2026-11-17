import { z } from "zod";
import type { AccessContext } from "./access.js";
import {
  executionPreferences,
  type ExecutionPreferences,
} from "./execution-preferences.js";
export * from "./execution-preferences.js";
export * from "./http.js";

const name = z
  .string()
  .trim()
  .min(1, "请填写名称")
  .max(80, "名称最多 80 个字符");
export const projectInput = z
  .object({
    name,
    goal: z.string().trim().max(12000, "项目目标最多 12000 个字符"),
  })
  .strict();
export const roleInput = z
  .object({
    name,
    description: z.string().trim().max(240, "职责简介最多 240 个字符"),
    instructions: z.string().trim().max(20000, "角色设定最多 20000 个字符"),
  })
  .strict();
export const createRoleInput = roleInput.extend({
  projectId: z.uuid().optional(),
});
export const roleChatIdentityInput = z
  .object({
    agentId: z.string().regex(/^[a-z][a-z0-9-]{0,49}$/),
    userId: z.string().startsWith("@").max(500),
  })
  .strict();
export type RoleChatIdentity = z.infer<typeof roleChatIdentityInput>;
export const runtimeReference = z
  .object({
    nodeId: z.uuid(),
    provider: z.string().trim().min(1).max(128),
  })
  .strict();
export type RuntimeReference = z.infer<typeof runtimeReference>;

/** Only explicit Hutian names override the stable device identity. */
export function runtimeDisplayLabel(
  nodeId: string,
  provider?: string | null,
  customName?: string | null,
) {
  const harness =
    provider === "codex"
      ? "Codex"
      : provider === "dsh"
        ? "DeepSeek Harness"
        : provider;
  return [customName?.trim() || nodeId, harness].filter(Boolean).join(" · ");
}

export const runtimeDeviceNameInput = z
  .object({
    nodeId: z.uuid(),
    connectionId: z.uuid(),
    sourceKey: z.string().regex(/^[a-f0-9]{64}$/),
    customName: z
      .string()
      .trim()
      .max(80)
      .refine(
        (value) =>
          [...value].every(
            (character) =>
              character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
          ),
        "名称不能包含控制字符",
      )
      .nullable()
      .transform((value) => value || null),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();
export type RuntimeDeviceNameInput = z.infer<typeof runtimeDeviceNameInput>;
export type RuntimeDeviceNames = {
  source: {
    workspaceId: string;
    connectionId: string;
    sourceKey: string;
  } | null;
  settings: { nodeId: string; customName: string | null; version: number }[];
};
export const roleRuntimeBindingInput = z
  .object({
    runtime: runtimeReference
      .extend({
        label: z.string().trim().min(1).max(200),
        preferences: executionPreferences.default({}),
      })
      .nullable(),
    expectedUpdatedAt: z.string().datetime().nullable(),
  })
  .strict();
export type RoleRuntimeBindingInput = z.infer<typeof roleRuntimeBindingInput>;
export interface RoleRuntimeBinding extends RuntimeReference {
  label: string;
  preferences?: ExecutionPreferences;
  updatedAt: string;
}
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
  chatIdentity: RoleChatIdentity | null;
  runtimeBinding: RoleRuntimeBinding | null;
}
export interface Workspace {
  access: AccessContext;
  creator: { id: string; displayName: string };
  projects: Project[];
  roles: Role[];
}

export * from "./access.js";
export * from "./chat.js";
export * from "./schedules.js";

export type * from "./workbench.js";

export * from "./conversation.js";

export * from "./operations.js";

export * from "./conversation-inputs.js";
