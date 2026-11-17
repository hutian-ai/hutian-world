import { ChatEffectRecovery1794931200001 } from "./migrations/chat-effect-recovery.js";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { CreatorSchema } from "../../modules/access/entities/creator.schema.js";
import { ChatEffectSchema } from "../../modules/chat-requests/entities/chat-effect.schema.js";
import { MembershipSchema } from "../../modules/projects/entities/membership.schema.js";
import { ProjectSchema } from "../../modules/projects/entities/project.schema.js";
import { RoleChatSchema } from "../../modules/roles/entities/role-chat.schema.js";
import { RoleRuntimeSchema } from "../../modules/roles/entities/role-runtime.schema.js";
import { RoleSchema } from "../../modules/roles/entities/role.schema.js";
import { RuntimeDeviceSettingSchema } from "../../modules/runtime-devices/entities/runtime-device-setting.schema.js";
import { ScheduleNoticeSchema } from "../../modules/schedules/entities/schedule-notice.schema.js";
import { ArchitectureLifecycle1794931200000 } from "./migrations/architecture-lifecycle.js";
import { ProjectsAndRoles1793892000000 } from "./migrations/initial.js";
import { RoleChatIdentity1794531600000 } from "./migrations/role-chat.js";
import { RoleRuntimeBinding1794535200000 } from "./migrations/role-runtime.js";
import { RuntimeDeviceSettings1794888000000 } from "./migrations/runtime-device-settings.js";
import { ScheduleInbox1794840000000 } from "./migrations/schedule-inbox.js";

import { ChatRequests1794771000000 } from "./migrations/chat-requests.js";
import { ExecutionPreferences1794772000000 } from "./migrations/execution-preferences.js";
import {
  ScheduledNoUpdate1794690001000,
  ScheduledPermissionWait1794820000000,
  ScheduledTaskDeletion1794690002000,
  ScheduledTasks1794690000000,
} from "./migrations/schedules.js";
import { WorkspaceAccess1794770000000 } from "./migrations/workspace-access.js";

import {
  AppUserSchema,
  ModuleConnectionSchema,
  WorkspaceMemberSchema,
  WorkspaceSchema,
} from "../../modules/access/entities/access.schema.js";
import { ChatRequestSchema } from "../../modules/chat-requests/entities/chat-request.schema.js";
import {
  ScheduledRunSchema,
  ScheduledTaskSchema,
} from "../../modules/schedules/entities/schedule.schema.js";

export function dataSource(url: string) {
  return new DataSource({
    type: "postgres",
    url,
    applicationName: "hutian-world",
    poolSize: 5,
    synchronize: false,
    migrationsRun: false,
    migrationsTransactionMode: "all",
    migrationsTableName: "hutian_world_migrations",
    migrations: [
      ProjectsAndRoles1793892000000,
      RoleChatIdentity1794531600000,
      RoleRuntimeBinding1794535200000,
      ScheduledTasks1794690000000,
      ScheduledNoUpdate1794690001000,
      ScheduledTaskDeletion1794690002000,
      WorkspaceAccess1794770000000,
      ChatRequests1794771000000,
      ExecutionPreferences1794772000000,
      ScheduledPermissionWait1794820000000,
      ScheduleInbox1794840000000,
      RuntimeDeviceSettings1794888000000,
      ArchitectureLifecycle1794931200000,
      ChatEffectRecovery1794931200001,
    ],
    entities: [
      ScheduleNoticeSchema,
      ChatEffectSchema,
      RuntimeDeviceSettingSchema,
      AppUserSchema,
      WorkspaceSchema,
      WorkspaceMemberSchema,
      ModuleConnectionSchema,
      ScheduledTaskSchema,
      ScheduledRunSchema,
      ChatRequestSchema,
      CreatorSchema,
      ProjectSchema,
      RoleSchema,
      MembershipSchema,
      RoleChatSchema,
      RoleRuntimeSchema,
    ],
    logging: false,
    invalidWhereValuesBehavior: { null: "throw", undefined: "throw" },
  });
}
