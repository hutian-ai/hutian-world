import {
  createRoleInput,
  projectInput,
  roleInput,
} from "@hutian-world/contracts";
import { z } from "zod";
import { api, ApiError } from "./api.js";

export interface ActionState {
  success?: boolean;
  error?: string;
  id?: string;
}
async function perform(
  work: () => Promise<{ id?: string }>,
): Promise<ActionState> {
  try {
    const result = await work();
    return { success: true, ...result };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? error.issues.map((i) => i.message).join("；")
          : error instanceof ApiError
            ? error.message
            : "操作结果尚未确认，请刷新后核对，避免重复创建。",
    };
  }
}
export async function saveProject(_state: ActionState, form: FormData) {
  return perform(async () => {
    const input = projectInput.parse({
      name: form.get("name"),
      goal: form.get("goal"),
    });
    const id = form.get("id");
    return id
      ? api<{ id: string }>(
          `/v1/projects/${z.uuid().parse(id)}`,
          "PATCH",
          input,
        )
      : api<{ id: string }>("/v1/projects", "POST", input);
  });
}
export async function saveRole(_state: ActionState, form: FormData) {
  return perform(async () => {
    const input = roleInput.parse({
      name: form.get("name"),
      description: form.get("description"),
      instructions: form.get("instructions"),
    });
    const id = form.get("id"),
      projectId = form.get("projectId");
    return id
      ? api<{ id: string }>(`/v1/roles/${z.uuid().parse(id)}`, "PATCH", input)
      : api<{ id: string }>(
          "/v1/roles",
          "POST",
          createRoleInput.parse({
            ...input,
            ...(projectId ? { projectId } : {}),
          }),
        );
  });
}
export async function changeMembership(_state: ActionState, form: FormData) {
  return perform(async () => {
    const projectId = z.uuid().parse(form.get("projectId"));
    const roleId = z.uuid().parse(form.get("roleId"));
    const mode = z.enum(["add", "remove"]).parse(form.get("mode"));
    await api(
      `/v1/projects/${projectId}/roles/${roleId}`,
      mode === "add" ? "PUT" : "DELETE",
    );
    return {};
  });
}
