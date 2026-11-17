export type MemoryDocument = {
  id: string;
  title: string;
  sourceTitle?: string;
  createdAt: string;
  status: string;
};
export type {
  ChatDirectory,
  ChatRole,
  Conversation,
  RoomKind,
} from "./conversation.js";
// Public request/response types for the Web application. No server imports.
import type * as Contracts from "./index.js";
import type {
  RoleRuntimeBinding,
  ScheduleCalendarItem,
  ScheduledRun,
  ScheduledTask,
} from "./index.js";
export type RuntimeCapabilities = {
  label: string;
  models: {
    id: string;
    name: string;
    efforts: string[];
    serviceTiers: string[];
    current: boolean;
  }[];
  current: Contracts.ExecutionPreferences;
  permissionModes: { id: string; name: string }[];
};
export type ActionState = { success?: boolean; error?: string; id?: string };
export type RoleRuntimeChoice = {
  nodeId: string;
  provider: string;
  label: string;
};
export type ChatPeer = {
  id: string;
  userId: string;
  name: string;
  description: string;
};
export type ChatMessage = {
  id: string;
  text: string;
  timestamp: number;
  sender: string;
  name: string;
  replyTo: string | null;
};
export type ChatEntry = { peer: ChatPeer; exists: boolean };
export type Reference = {
  id: string;
  kind: "memory" | "knowledge";
  title: string;
  text: string;
  url: string;
  version: string;
};
export type KnowledgeDocument = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  status: "indexing" | "ready" | "unknown" | "failed";
  upstreamIds?: string[];
  previousId?: string;
  version?: number;
};
export type DockDevice = {
  customName: string | null;
  nameSettings?: { connectionId: string; sourceKey: string; version: number };
  nodeId: string;
  label?: string | undefined;
  connected: boolean;
};
export type DockDirectoryDevice = DockDevice & {
  hostname?: string;
  platform?: string;
  inventoryState: "online" | "offline" | "unknown";
  message?: string;
  runtimes: {
    key: string;
    displayName: string;
    status: string;
    version: string | null;
    modelCount: number;
  }[];
};
export type DockConnection =
  | { state: "missing" }
  | { state: "error"; message: string }
  | { state: "connected"; endpoint: string; devices: DockDirectoryDevice[] };
export type ResourceScope =
  | { kind: "workspace" }
  | { kind: "role"; id: string }
  | { kind: "conversation"; id: string };

export interface WorkbenchCommands {
  "projects.save": (
    _state: ActionState,
    form: FormData,
  ) => Promise<ActionState>;
  "members.save": (_state: ActionState, form: FormData) => Promise<ActionState>;
  "projects.changeMembership": (
    _state: ActionState,
    form: FormData,
  ) => Promise<ActionState>;
  "conversations.openPrivate": (
    value: string,
  ) => Promise<{ ok: true; error?: undefined } | { ok: false; error: string }>;
  "conversations.sendPrivate": (
    value: string,
    text: string,
    transactionId: string,
  ) => Promise<
    | { ok: false; error: string; eventId?: undefined }
    | { ok: true; eventId: string; error?: undefined }
  >;
  "resources.saveChatResult": (input: {
    id: string;
    roomId: string;
    eventId: string;
    kind: "memory" | "knowledge";
    title: string;
    content: string;
    scope: ResourceScope;
  }) => Promise<
    | { ok: true; status: string; error?: undefined }
    | { ok: false; error: string; status?: undefined }
  >;
  "conversations.refreshConversation": (id: string) => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        conversation: Contracts.Conversation;
      }
  >;
  "conversations.createCommunication": (
    input: Contracts.CreateCommunicationInput,
  ) => Promise<{ ok: false; error: string } | { ok: true; roomId: string }>;
  "conversations.openRoleConversation": (
    id: string,
  ) => Promise<{ ok: false; error: string } | { ok: true; roomId: string }>;
  "conversations.postConversation": (
    input: Contracts.PostConversationInput,
  ) => Promise<{ ok: false; error: string } | { ok: true; eventId: string }>;
  "conversations.askConversation": (
    input: Contracts.AskConversationInput,
  ) => Promise<
    { ok: false; error: string } | { ok: true; references: Reference[] }
  >;
  "conversations.discoverChatRuntimes": () => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        pendingDevices: { nodeId: string; label: string }[];
        runtimes: { nodeId: string; provider: string; label: string }[];
      }
  >;
  "conversations.controlConversation": (
    input: Contracts.ControlConversationInput,
  ) => Promise<{ ok: false; error: string } | { ok: true; result: unknown }>;
  "conversations.controlConversationQueue": (
    input: Contracts.ControlConversationQueueInput,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "conversations.retrieveConversationOutputs": (
    input: Contracts.RetrieveConversationOutputsInput,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "conversations.handoffConversation": (
    input: Contracts.HandoffConversationInput,
  ) => Promise<{ ok: false; error: string } | { ok: true; eventId: string }>;
  "conversations.inviteConversation": (
    id: string,
    peer: string,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "runtimes.connectDockFromFile": (
    form: FormData,
  ) => Promise<{ ok: false; error: string } | { ok: true; error?: undefined }>;
  "runtimes.readRuntimeCapabilities": (
    input: Contracts.RuntimeReference,
  ) => Promise<
    | { ok: true; capabilities: RuntimeCapabilities; error?: undefined }
    | { ok: false; error: string; capabilities?: undefined }
  >;
  "resources.loadResources": (
    kind: "memory" | "knowledge",
    scope?: ResourceScope,
    cursor?: string,
  ) => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        data: {
          documents: (MemoryDocument | KnowledgeDocument)[];
          nextCursor: string | null;
          resource?: string;
          writeMode?: "infer" | "verbatim";
        };
      }
  >;
  "resources.saveResource": (
    kind: "memory" | "knowledge",
    input: { id: string; title: string; content: string },
    scope?: ResourceScope,
  ) => Promise<
    | { ok: false; error: string }
    | { ok: true; data: { status?: string; [key: string]: unknown } }
  >;
  "resources.findResources": (
    kind: "memory" | "knowledge",
    query: string,
    scope?: ResourceScope,
  ) => Promise<
    { ok: false; error: string } | { ok: true; references: Reference[] }
  >;
  "resources.readMemorySource": (
    id: string,
    scope?: ResourceScope,
  ) => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        data: {
          original_text?: string;
          document_metadata?: Record<string, unknown> | null;
          provided_by?: string;
        };
      }
  >;
  "resources.readKnowledgeSource": (
    id: string,
    scope?: ResourceScope,
  ) => Promise<
    { ok: true; data: KnowledgeDocument } | { ok: false; error: string }
  >;
  "resources.inspectResourcePlugins": (scope?: ResourceScope) => Promise<
    Array<{
      id: string;
      kind: "memory" | "knowledge";
      status: "ready" | "unconfigured" | "unavailable";
    }>
  >;
  "resources.observeMemory": (
    id: string,
    scope?: ResourceScope,
  ) => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        data: { status: string; operation_id?: string; [key: string]: unknown };
      }
  >;
  "members.setRuntime": (
    id: string,
    input:
      | (Contracts.RuntimeReference & {
          preferences?: Contracts.ExecutionPreferences;
        })
      | null,
    expected: string | null,
  ) => Promise<
    | { ok: true; binding: RoleRuntimeBinding | null; error?: undefined }
    | { ok: false; error: string; binding?: undefined }
  >;
  "schedules.loadSchedules": () => Promise<
    | { ok: false; error: string }
    | {
        tasks: ScheduledTask[];
        runs: ScheduledRun[];
        nextCursor: string | null;
        ok: true;
      }
  >;
  "schedules.loadSchedule": (id: string) => Promise<
    | { ok: false; error: string }
    | {
        task: ScheduledTask;
        runs: ScheduledRun[];
        nextCursor: string | null;
        ok: true;
      }
  >;
  "schedules.loadScheduledRun": (
    id: string,
  ) => Promise<{ ok: false; error: string } | { ok: true; run: ScheduledRun }>;
  "schedules.deleteSchedule": (
    id: string,
    expectedRevision: number,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "schedules.loadScheduleCalendar": (
    input: import("zod").input<typeof Contracts.scheduleCalendarQuery>,
  ) => Promise<
    | { ok: false; error: string }
    | { items: ScheduleCalendarItem[]; timeZone: string; ok: true }
  >;
  "schedules.saveSchedule": (
    input: import("zod").input<typeof Contracts.scheduleInput>,
    expectedRevision: number | null,
  ) => Promise<
    { ok: false; error: string } | { ok: true; task: ScheduledTask }
  >;
  "schedules.toggleSchedule": (
    id: string,
    enabled: boolean,
    expectedRevision: number,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "schedules.runSchedule": (
    id: string,
    requestId: string,
  ) => Promise<{ ok: false; error: string } | { ok: true; run: ScheduledRun }>;
  "schedules.previewScheduleRule": (
    input: import("zod").input<typeof Contracts.scheduleRule>,
  ) => Promise<{ ok: false; error: string } | { starts: string[]; ok: true }>;
  "schedules.readScheduledResult": (id: string) => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        message: {
          id: string;
          text: string;
          sender: string;
          timestamp: number;
          replyTo: string | null;
        };
        attachments: { name: string; href: string; sourcePath: string }[];
        outputsState: "pending" | "available" | "none" | "unconfirmed" | null;
      }
  >;
  "schedules.scheduleChoices": () => Promise<{
    roles: { id: string; name: string; configured: boolean }[];
  }>;
  "members.runtimeChoices": () => Promise<{
    choices: RoleRuntimeChoice[];
    error: string;
  }>;
  "conversations.direct": (selectedId?: string) => Promise<
    | {
        directory: {
          peer: {
            id: string;
            userId: string;
            name: string;
            description: string;
          };
          exists: boolean;
        }[];
        selected: undefined;
        messages: never[];
        error: string | undefined;
      }
    | {
        directory: {
          peer: {
            id: string;
            userId: string;
            name: string;
            description: string;
          };
          exists: boolean;
        }[];
        selected: {
          id: string;
          userId: string;
          name: string;
          description: string;
        };
        messages: {
          id: string;
          text: string;
          timestamp: number;
          sender: string;
          name: string;
          replyTo: string | null;
        }[];
        error: undefined;
      }
    | {
        directory: {
          peer: {
            id: string;
            userId: string;
            name: string;
            description: string;
          };
          exists: boolean;
        }[];
        selected: {
          id: string;
          userId: string;
          name: string;
          description: string;
        };
        messages: never[];
        error: string;
      }
  >;
  "conversations.directory": () => Promise<{
    agents: {
      id: string;
      userId: string;
      name: string;
      description: string;
      joined?: boolean | undefined;
      roleId?: string | undefined;
      runtimeBinding?:
        | {
            nodeId: string;
            provider: string;
            label: string;
            preferences: {
              model?: string | undefined;
              effort?: string | undefined;
              mode?: string | undefined;
              serviceTier?: string | undefined;
            };
            updatedAt: string;
          }
        | null
        | undefined;
    }[];
    roles: {
      id: string;
      name: string;
      description: string;
      chatIdentity: { agentId: string; userId: string } | null;
      runtimeBinding: Contracts.RoleRuntimeBinding | null;
    }[];
    rooms: { id: string; name: string; kind: "direct" | "group" | "channel" }[];
  }>;
  "conversations.read": (
    id: string,
    cursor?: string,
  ) => Promise<Contracts.Conversation>;
  "runtimes.renameDevice": (
    input: Contracts.RuntimeDeviceNameInput,
  ) => Promise<
    | { ok: true; customName: string | null; version: number }
    | { ok: false; error: string }
  >;
  "runtimes.connection": () => Promise<DockConnection>;
  "runtimes.device": (nodeId: string) => Promise<
    | {
        state: "offline";
        device: DockDevice;
        message?: undefined;
        runtimes?: undefined;
        platform?: undefined;
      }
    | {
        state: "unknown";
        device: DockDevice;
        message: string;
        runtimes?: undefined;
        platform?: undefined;
      }
    | {
        state: "online";
        device: DockDevice;
        runtimes: {
          message?: string | undefined;
          key: string;
          displayName: string;
          status: "ready" | "not_found" | "unavailable" | "disabled";
          version: string | null;
          models: {
            id: string;
            name: string;
            efforts: string[];
            serviceTiers: string[];
            current: boolean;
          }[];
          permissionModes: { id: string; name: string }[];
          defaults: {
            mode: string | undefined;
            model: string | undefined;
            effort: string | undefined;
            serviceTier: string | undefined;
          };
          sessionResume: boolean;
        }[];
        platform: { hostname: string; platform: string };
        message?: undefined;
      }
    | { state: "error"; message: string }
  >;
  "resources.resolveResourceScope": (input?: ResourceScope) => Promise<
    | { key: string; label: string; description: string; kind: "workspace" }
    | {
        key: string;
        label: string;
        description: string;
        kind: "role";
        id: string;
      }
    | {
        key: string;
        label: string;
        description: string;
        kind: "conversation";
        id: string;
      }
  >;
  "resources.resourceScopeOptions": () => Promise<{
    options: { scope: ResourceScope; label: string }[];
    conversationsUnavailable: boolean;
  }>;
}
