import { z } from "zod";

export const moduleKind = z.enum(["matrix", "dock", "resources", "reports"]);
export type ModuleKind = z.infer<typeof moduleKind>;
export const accessContext = z
  .object({
    userId: z.uuid(),
    creatorId: z.uuid(),
    workspaceId: z.uuid(),
    membershipRole: z.enum(["owner", "member"]),
    identitySource: z.literal("local-owner"),
    resourceNamespace: z.string().min(1).max(100),
    connections: z
      .object({
        matrix: z.uuid(),
        dock: z.uuid(),
        resources: z.uuid(),
        reports: z.uuid(),
      })
      .strict(),
  })
  .strict();
export type AccessContext = z.infer<typeof accessContext>;
export interface RecordAuthority {
  workspaceId: string;
  createdByUserId: string;
}
export interface RunAuthority {
  workspaceId: string;
  requestedByUserId: string;
  runAsUserId: string;
  communicationConnectionId: string;
  runtimeConnectionId: string;
}
