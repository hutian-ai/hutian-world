import type { WorkbenchCommands } from "@hutian-world/contracts";
import * as m0 from "./services/actions.js";
import * as m1 from "./services/chat-actions.js";
import * as m2 from "./services/chat-result-actions.js";
import * as m3 from "./services/communication-actions.js";
import * as m4 from "./services/dock-actions.js";
import * as m5 from "./services/execution-settings-actions.js";
import * as m6 from "./services/resource-actions.js";
import * as m7 from "./services/role-runtime-actions.js";
import * as m8 from "./services/schedule-actions.js";
import * as m9 from "./services/schedule-data.js";
import * as m10 from "./services/role-runtime.js";
import * as m11 from "./services/direct-chat.js";
import * as m12 from "./services/communications.js";
import * as m13 from "./services/dock.js";
import * as m14 from "./services/resource-scopes.js";

// Explicit public operations; internal helpers are never exported as browser commands.
export const commands = {
  "actions.saveProject": m0.saveProject,
  "actions.saveRole": m0.saveRole,
  "actions.changeMembership": m0.changeMembership,
  "chat-actions.openPrivateConversation": m1.openPrivateConversation,
  "chat-actions.sendPrivateMessage": m1.sendPrivateMessage,
  "chat-result-actions.saveChatResult": m2.saveChatResult,
  "communication-actions.refreshConversation": m3.refreshConversation,
  "communication-actions.createCommunication": m3.createCommunication,
  "communication-actions.openRoleConversation": m3.openRoleConversation,
  "communication-actions.postConversation": m3.postConversation,
  "communication-actions.askConversation": (input: unknown) =>
    m3.askConversation(input),
  "communication-actions.discoverChatRuntimes": m3.discoverChatRuntimes,
  "communication-actions.controlConversation": m3.controlConversation,
  "communication-actions.controlConversationQueue": m3.controlConversationQueue,
  "communication-actions.retrieveConversationOutputs":
    m3.retrieveConversationOutputs,
  "communication-actions.handoffConversation": m3.handoffConversation,
  "communication-actions.inviteConversation": m3.inviteConversation,
  "dock-actions.connectDockFromFile": m4.connectDockFromFile,
  "execution-settings-actions.readRuntimeCapabilities":
    m5.readRuntimeCapabilities,
  "resource-actions.loadResources": m6.loadResources,
  "resource-actions.saveResource": m6.saveResource,
  "resource-actions.findResources": m6.findResources,
  "resource-actions.readMemorySource": m6.readMemorySource,
  "resource-actions.observeMemory": m6.observeMemory,
  "resource-actions.readKnowledgeSource": m6.readKnowledgeSource,
  "resource-actions.inspectResourcePlugins": m6.inspectResourcePlugins,
  "role-runtime-actions.saveRoleRuntime": m7.saveRoleRuntime,
  "schedule-actions.loadSchedules": m8.loadSchedules,
  "schedule-actions.loadSchedule": m8.loadSchedule,
  "schedule-actions.loadScheduledRun": m8.loadScheduledRun,
  "schedule-actions.deleteSchedule": m8.deleteSchedule,
  "schedule-actions.loadScheduleCalendar": m8.loadScheduleCalendar,
  "schedule-actions.saveSchedule": m8.saveSchedule,
  "schedule-actions.toggleSchedule": m8.toggleSchedule,
  "schedule-actions.runSchedule": m8.runSchedule,
  "schedule-actions.previewScheduleRule": m8.previewScheduleRule,
  "schedule-actions.readScheduledResult": m8.readScheduledResult,
  "schedule-data.scheduleChoices": m9.scheduleChoices,
  "role-runtime.roleRuntimeChoices": m10.roleRuntimeChoices,
  "direct-chat.getDirectChat": m11.getDirectChat,
  "communications.readDirectory": m12.readDirectory,
  "communications.readConversation": m12.readConversation,
  "dock.saveRuntimeDeviceName": m13.saveRuntimeDeviceName,
  "dock.getDockConnection": m13.getDockConnection,
  "dock.getDockDevice": m13.getDockDevice,
  "resource-scopes.resolveResourceScope": m14.resolveResourceScope,
  "resource-scopes.resourceScopeOptions": m14.resourceScopeOptions,
} satisfies WorkbenchCommands;
