import { command } from "./api";
export type * from "@hutian-world/contracts";
export const saveProject = command("actions.saveProject");
export const saveRole = command("actions.saveRole");
export const changeMembership = command("actions.changeMembership");
