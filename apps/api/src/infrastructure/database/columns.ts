export const workspaceColumns = {
  workspaceId: { type: "uuid" as const, name: "workspace_id" },
  createdByUserId: { type: "uuid" as const, name: "created_by_user_id" },
};
export const workspaceColumn = {
  workspaceId: { type: "uuid" as const, name: "workspace_id" },
};
export const id = { type: "uuid" as const, primary: true };
export const createdAt = {
  type: "timestamptz" as const,
  createDate: true,
  name: "created_at",
};
export const updatedAt = {
  type: "timestamptz" as const,
  updateDate: true,
  name: "updated_at",
};
