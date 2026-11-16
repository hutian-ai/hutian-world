import { getWorkspace } from "./api.js";
export async function scheduleChoices() {
  const workspace = await getWorkspace();
  return {
    roles: workspace.roles.map(({ id, name, runtimeBinding }) => ({
      id,
      name,
      configured: Boolean(runtimeBinding),
    })),
  };
}
