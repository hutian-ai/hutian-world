import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Role } from "@hutian-world/contracts";
import { api } from "./api";
import { communicationRequest } from "./communications";

const managedAgent = z.object({ agent: z.object({ id: z.string(), userId: z.string(), name: z.string(), description: z.string() }) });

export async function ensureRoleAgent(role: Role) {
  const id = role.chatIdentity?.agentId ?? `role-${role.id.replaceAll("-", "")}`;
  const { agent } = managedAgent.parse(await communicationRequest("/api/agents", {
    id, name: role.name, description: role.description,
  }));
  if (agent.id !== id || (role.chatIdentity && role.chatIdentity.userId !== agent.userId))
    throw new Error("角色通信身份与原关联不一致，请先核对。");
  await api(`/v1/roles/${role.id}/chat-identity`, "PUT", { agentId: agent.id, userId: agent.userId });
  return agent;
}

export function roleExecutionContext(role: Role) {
  const definition = { id: role.id, name: role.name, description: role.description, instructions: role.instructions };
  const hash = createHash("sha256").update(JSON.stringify(definition)).digest("hex");
  return {
    instructions: `你在本次对话中的成员身份是：${role.name}。\n职责：${role.description || "与用户协作"}\n\n${role.instructions || "按职责直接回答，说明依据和不确定性。"}`,
    instructionsVersion: `${role.updatedAt}#${hash}`,
    instructionsLabel: role.name,
    instructionsSource: `hutian://roles/${role.id}`,
  };
}
