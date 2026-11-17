import { command } from "./api";
export type * from "@hutian-world/contracts";
export const saveProject = command("projects.save");
export const saveRole = command("members.save");
export const changeMembership = command("projects.changeMembership");
