import type { ApplicationServices } from "../application-services.js";
export async function scheduleChoices(
  app: Pick<ApplicationServices, "workspace">,
) {
  const workspace = await app.workspace.overview();
  return {
    roles: workspace.roles.map(({ id, name, runtimeBinding }) => ({
      id,
      name,
      configured: Boolean(runtimeBinding),
    })),
  };
}
