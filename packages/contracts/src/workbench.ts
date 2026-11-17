// Public request/response types for the Web application. No server imports.
import type * as Contracts from "./index.js";
import type {
  RoleRuntimeBinding,
  ScheduledTask,
  ScheduledRun,
  ScheduleCalendarItem,
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
export type ChatRole = {
  name: string;
  description: string;
  id: string;
  runtimeBinding: Contracts.RoleRuntimeBinding | null;
  chatIdentity: Contracts.RoleChatIdentity | null;
};
export type ChatDirectory = {
  rooms: { id: string; name: string; kind: "direct" | "group" | "channel" }[];
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
} & { roles: ChatRole[] };
export type Conversation = {
  room: { id: string; name: string };
  members: { id: string; name: string; kind: string }[];
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
  messages: {
    id: string;
    text: string;
    timestamp: number;
    sender: string;
    name: string;
    agentId: string | null;
    replyTo: string | null;
    attachments: { id: string; name: string; mime: string; size: number }[];
    mentionedUserIds: string[];
  }[];
  jobs: {
    agentId: string;
    eventId: string;
    runId: string | null;
    state: string;
    error: string | null;
    instructionsVersion?: string | null | undefined;
    instructionsLabel?: string | null | undefined;
    instructionsSource?: string | null | undefined;
    runtimeLabel?: string | null | undefined;
    nodeId?: string | null | undefined;
    provider?: string | null | undefined;
    model?: string | null | undefined;
    config?:
      | {
          effort?: string | undefined;
          mode?: string | undefined;
          serviceTier?: string | undefined;
        }
      | null
      | undefined;
    activity?:
      | {
          version: 1;
          runId: string;
          revision: number;
          state: string;
          startedAt: string;
          finishedAt: string | null;
          steering: boolean;
          historyTruncated: boolean;
          events: {
            sequence: number;
            at: string;
            type: string;
            payload: Record<string, unknown>;
          }[];
          interactions: {
            id: string;
            title: string;
            status: string;
            canAllow: boolean;
            details?: unknown;
            options?:
              { optionId: string; name: string; kind: string }[] | undefined;
            form?:
              | {
                  mode: string;
                  message: string;
                  requestedSchema?: Record<string, unknown> | undefined;
                  url?: string | undefined;
                }
              | undefined;
          }[];
          commands: {
            id: string;
            kind: string;
            status: string;
            at: string;
            result?: unknown;
          }[];
          outputs: { reference: string; name: string; sha256: string }[];
          outputsState: "pending" | "available" | "none" | "unconfirmed";
        }
      | null
      | undefined;
    replyEventId?: string | null | undefined;
    references?: { id: string; title: string; url: string }[];
  }[];
  queue: {
    id: string;
    eventId: string;
    agentId: string;
    state: "queued" | "paused";
    createdAt: number;
  }[];
  active: { agentId: string; roomId: string; eventId: string } | null;
  nextCursor: string | null;
};
export type RoomKind = "direct" | "group" | "channel";
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
  "actions.saveProject": (
    _state: ActionState,
    form: FormData,
  ) => Promise<ActionState>;
  "actions.saveRole": (
    _state: ActionState,
    form: FormData,
  ) => Promise<ActionState>;
  "actions.changeMembership": (
    _state: ActionState,
    form: FormData,
  ) => Promise<ActionState>;
  "chat-actions.openPrivateConversation": (
    value: string,
  ) => Promise<{ ok: true; error?: undefined } | { ok: false; error: string }>;
  "chat-actions.sendPrivateMessage": (
    value: string,
    text: string,
    transactionId: string,
  ) => Promise<
    | { ok: false; error: string; eventId?: undefined }
    | { ok: true; eventId: string; error?: undefined }
  >;
  "chat-result-actions.saveChatResult": (
    input: unknown,
  ) => Promise<
    | { ok: true; status: string; error?: undefined }
    | { ok: false; error: string; status?: undefined }
  >;
  "communication-actions.refreshConversation": (id: string) => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        conversation: {
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
          members: { id: string; name: string; kind: string }[];
          messages: {
            id: string;
            text: string;
            timestamp: number;
            sender: string;
            name: string;
            agentId: string | null;
            replyTo: string | null;
            attachments: {
              id: string;
              name: string;
              mime: string;
              size: number;
            }[];
            mentionedUserIds: string[];
          }[];
          room: { id: string; name: string };
          jobs: {
            agentId: string;
            eventId: string;
            runId: string | null;
            state: string;
            error: string | null;
            instructionsVersion?: string | null | undefined;
            instructionsLabel?: string | null | undefined;
            instructionsSource?: string | null | undefined;
            runtimeLabel?: string | null | undefined;
            nodeId?: string | null | undefined;
            provider?: string | null | undefined;
            model?: string | null | undefined;
            config?:
              | {
                  effort?: string | undefined;
                  mode?: string | undefined;
                  serviceTier?: string | undefined;
                }
              | null
              | undefined;
            activity?:
              | {
                  version: 1;
                  runId: string;
                  revision: number;
                  state: string;
                  startedAt: string;
                  finishedAt: string | null;
                  steering: boolean;
                  historyTruncated: boolean;
                  events: {
                    sequence: number;
                    at: string;
                    type: string;
                    payload: Record<string, unknown>;
                  }[];
                  interactions: {
                    id: string;
                    title: string;
                    status: string;
                    canAllow: boolean;
                    details?: unknown;
                    options?:
                      | { optionId: string; name: string; kind: string }[]
                      | undefined;
                    form?:
                      | {
                          mode: string;
                          message: string;
                          requestedSchema?: Record<string, unknown> | undefined;
                          url?: string | undefined;
                        }
                      | undefined;
                  }[];
                  commands: {
                    id: string;
                    kind: string;
                    status: string;
                    at: string;
                    result?: unknown;
                  }[];
                  outputs: {
                    reference: string;
                    name: string;
                    sha256: string;
                  }[];
                  outputsState:
                    "pending" | "available" | "none" | "unconfirmed";
                }
              | null
              | undefined;
            replyEventId?: string | null | undefined;
            references?: { id: string; title: string; url: string }[];
          }[];
          queue: {
            id: string;
            eventId: string;
            agentId: string;
            state: "queued" | "paused";
            createdAt: number;
          }[];
          active: { agentId: string; roomId: string; eventId: string } | null;
          nextCursor: string | null;
        };
      }
  >;
  "communication-actions.createCommunication": (
    input: unknown,
  ) => Promise<{ ok: false; error: string } | { ok: true; roomId: string }>;
  "communication-actions.openRoleConversation": (
    id: string,
  ) => Promise<{ ok: false; error: string } | { ok: true; roomId: string }>;
  "communication-actions.postConversation": (
    input: unknown,
  ) => Promise<{ ok: false; error: string } | { ok: true; eventId: string }>;
  "communication-actions.askConversation": (
    input: unknown,
  ) => Promise<
    { ok: false; error: string } | { ok: true; references: Reference[] }
  >;
  "communication-actions.discoverChatRuntimes": () => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        pendingDevices: { nodeId: string; label: string }[];
        runtimes: { nodeId: string; provider: string; label: string }[];
      }
  >;
  "communication-actions.controlConversation": (
    input: unknown,
  ) => Promise<{ ok: false; error: string } | { ok: true; result: unknown }>;
  "communication-actions.controlConversationQueue": (
    input: unknown,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "communication-actions.retrieveConversationOutputs": (
    input: unknown,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "communication-actions.handoffConversation": (
    input: unknown,
  ) => Promise<{ ok: false; error: string } | { ok: true; eventId: string }>;
  "communication-actions.inviteConversation": (
    id: string,
    peer: string,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "dock-actions.connectDockFromFile": (
    form: FormData,
  ) => Promise<{ ok: false; error: string } | { ok: true; error?: undefined }>;
  "execution-settings-actions.readRuntimeCapabilities": (
    input: unknown,
  ) => Promise<
    | { ok: true; capabilities: RuntimeCapabilities; error?: undefined }
    | { ok: false; error: string; capabilities?: undefined }
  >;
  "resource-actions.loadResources": (
    kind: "memory" | "knowledge",
    scope?: ResourceScope,
  ) => Promise<
    | { ok: false; error: string }
    | {
        ok: true;
        data:
          | {
              resource: string;
              documents: any[];
              writeMode: "infer" | "verbatim";
            }
          | {
              resource: string;
              documents: {
                id: string;
                title: string;
                createdAt: string;
                status: string;
              }[];
              writeMode?: undefined;
            }
          | { documents: KnowledgeDocument[] };
      }
  >;
  "resource-actions.saveResource": (
    kind: "memory" | "knowledge",
    input: unknown,
    scope?: ResourceScope,
  ) => Promise<{ ok: false; error: string } | { ok: true; data: any }>;
  "resource-actions.findResources": (
    kind: "memory" | "knowledge",
    query: string,
    scope?: ResourceScope,
  ) => Promise<
    { ok: false; error: string } | { ok: true; references: Reference[] }
  >;
  "resource-actions.readMemorySource": (
    id: string,
    scope?: ResourceScope,
  ) => Promise<{ ok: false; error: string } | { ok: true; data: any }>;
  "resource-actions.readKnowledgeSource": (
    id: string,
    scope?: ResourceScope,
  ) => Promise<
    { ok: true; data: KnowledgeDocument } | { ok: false; error: string }
  >;
  "resource-actions.inspectResourcePlugins": (scope?: ResourceScope) => Promise<
    Array<{
      id: string;
      kind: "memory" | "knowledge";
      status: "ready" | "unconfigured" | "unavailable";
    }>
  >;
  "resource-actions.observeMemory": (
    id: string,
    scope?: ResourceScope,
  ) => Promise<{ ok: false; error: string } | { ok: true; data: any }>;
  "role-runtime-actions.saveRoleRuntime": (
    id: string,
    input: unknown,
    expected: unknown,
  ) => Promise<
    | { ok: true; binding: RoleRuntimeBinding | null; error?: undefined }
    | { ok: false; error: string; binding?: undefined }
  >;
  "schedule-actions.loadSchedules": () => Promise<
    | { ok: false; error: string }
    | { tasks: ScheduledTask[]; runs: ScheduledRun[]; ok: true }
  >;
  "schedule-actions.loadSchedule": (
    id: string,
  ) => Promise<
    | { ok: false; error: string }
    | { task: ScheduledTask; runs: ScheduledRun[]; ok: true }
  >;
  "schedule-actions.loadScheduledRun": (
    id: string,
  ) => Promise<{ ok: false; error: string } | { ok: true; run: ScheduledRun }>;
  "schedule-actions.deleteSchedule": (
    id: string,
    expectedRevision: number,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "schedule-actions.loadScheduleCalendar": (
    input: unknown,
  ) => Promise<
    | { ok: false; error: string }
    | { items: ScheduleCalendarItem[]; timeZone: string; ok: true }
  >;
  "schedule-actions.saveSchedule": (
    input: unknown,
    expectedRevision: number | null,
  ) => Promise<
    { ok: false; error: string } | { ok: true; task: ScheduledTask }
  >;
  "schedule-actions.toggleSchedule": (
    id: string,
    enabled: boolean,
    expectedRevision: number,
  ) => Promise<{ ok: false; error: string } | { ok: true }>;
  "schedule-actions.runSchedule": (
    id: string,
    requestId: string,
  ) => Promise<{ ok: false; error: string } | { ok: true; run: ScheduledRun }>;
  "schedule-actions.previewScheduleRule": (
    input: unknown,
  ) => Promise<{ ok: false; error: string } | { starts: string[]; ok: true }>;
  "schedule-actions.readScheduledResult": (id: string) => Promise<
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
  "schedule-data.scheduleChoices": () => Promise<{
    roles: { id: string; name: string; configured: boolean }[];
  }>;
  "role-runtime.roleRuntimeChoices": () => Promise<{
    choices: RoleRuntimeChoice[];
    error: string;
  }>;
  "direct-chat.getDirectChat": (selectedId?: string) => Promise<
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
  "communications.readDirectory": () => Promise<{
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
  "communications.readConversation": (
    id: string,
    cursor?: string,
  ) => Promise<{
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
    members: { id: string; name: string; kind: string }[];
    messages: {
      id: string;
      text: string;
      timestamp: number;
      sender: string;
      name: string;
      agentId: string | null;
      replyTo: string | null;
      attachments: { id: string; name: string; mime: string; size: number }[];
      mentionedUserIds: string[];
    }[];
    room: { id: string; name: string };
    jobs: {
      agentId: string;
      eventId: string;
      runId: string | null;
      state: string;
      error: string | null;
      instructionsVersion?: string | null | undefined;
      instructionsLabel?: string | null | undefined;
      instructionsSource?: string | null | undefined;
      runtimeLabel?: string | null | undefined;
      nodeId?: string | null | undefined;
      provider?: string | null | undefined;
      model?: string | null | undefined;
      config?:
        | {
            effort?: string | undefined;
            mode?: string | undefined;
            serviceTier?: string | undefined;
          }
        | null
        | undefined;
      activity?:
        | {
            version: 1;
            runId: string;
            revision: number;
            state: string;
            startedAt: string;
            finishedAt: string | null;
            steering: boolean;
            historyTruncated: boolean;
            events: {
              sequence: number;
              at: string;
              type: string;
              payload: Record<string, unknown>;
            }[];
            interactions: {
              id: string;
              title: string;
              status: string;
              canAllow: boolean;
              details?: unknown;
              options?:
                { optionId: string; name: string; kind: string }[] | undefined;
              form?:
                | {
                    mode: string;
                    message: string;
                    requestedSchema?: Record<string, unknown> | undefined;
                    url?: string | undefined;
                  }
                | undefined;
            }[];
            commands: {
              id: string;
              kind: string;
              status: string;
              at: string;
              result?: unknown;
            }[];
            outputs: { reference: string; name: string; sha256: string }[];
            outputsState: "pending" | "available" | "none" | "unconfirmed";
          }
        | null
        | undefined;
      replyEventId?: string | null | undefined;
      references?: { id: string; title: string; url: string }[];
    }[];
    queue: {
      id: string;
      eventId: string;
      agentId: string;
      state: "queued" | "paused";
      createdAt: number;
    }[];
    active: { agentId: string; roomId: string; eventId: string } | null;
    nextCursor: string | null;
  }>;
  "dock.saveRuntimeDeviceName": (
    input: Contracts.RuntimeDeviceNameInput,
  ) => Promise<
    | { ok: true; customName: string | null; version: number }
    | { ok: false; error: string }
  >;
  "dock.getDockConnection": () => Promise<DockConnection>;
  "dock.getDockDevice": (nodeId: string) => Promise<
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
  "resource-scopes.resolveResourceScope": (input?: ResourceScope) => Promise<
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
  "resource-scopes.resourceScopeOptions": () => Promise<{
    options: { scope: ResourceScope; label: string }[];
    conversationsUnavailable: boolean;
  }>;
}
