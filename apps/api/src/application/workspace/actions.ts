import {
  createRoleInput,
  projectInput,
  roleInput,
} from "@hutian-world/contracts";
import { z } from "zod";
import { actionFailure } from "../../common/errors/application-error.js";
import type { ApplicationServices } from "../application-services.js";
export interface ActionState {
  success?: boolean;
  error?: string;
  id?: string;
}
async function perform(
  work: () => Promise<{
    id?: string;
  }>,
): Promise<ActionState> {
  try {
    const result = await work();
    return { success: true, ...result };
  } catch (error) {
    return actionFailure(error);
  }
}
export async function saveProject(
  app: Pick<ApplicationServices, "projects">,
  _state: ActionState,
  form: FormData,
) {
  return perform(async () => {
    const input = projectInput.parse({
      name: form.get("name"),
      goal: form.get("goal"),
    });
    const id = form.get("id");
    return id
      ? app.projects.updateProject(z.uuid().parse(id), input)
      : app.projects.createProject(input);
  });
}
export async function saveRole(
  app: Pick<ApplicationServices, "roles">,
  _state: ActionState,
  form: FormData,
) {
  return perform(async () => {
    const input = roleInput.parse({
      name: form.get("name"),
      description: form.get("description"),
      instructions: form.get("instructions"),
    });
    const id = form.get("id"),
      projectId = form.get("projectId");
    return id
      ? app.roles.updateRole(z.uuid().parse(id), input)
      : app.roles.createRole(
          createRoleInput.parse({
            ...input,
            ...(projectId ? { projectId } : {}),
          }),
        );
  });
}
export async function changeMembership(
  app: Pick<ApplicationServices, "projects">,
  _state: ActionState,
  form: FormData,
) {
  return perform(async () => {
    const projectId = z.uuid().parse(form.get("projectId"));
    const roleId = z.uuid().parse(form.get("roleId"));
    const mode = z.enum(["add", "remove"]).parse(form.get("mode"));
    await app.projects.membership(projectId, roleId, mode === "remove");
    return {};
  });
}
