import { readRuntimeOverview } from "../../application/runtimes/runtime-overview.js";
import type { WorkbenchCommands } from "@hutian-world/contracts";
import type { ApplicationServices } from "../../application/application-services.js";
import * as m1 from "../../application/conversations/chat-actions.js";
import * as m2 from "../../application/conversations/chat-result-actions.js";
import * as m3 from "../../application/conversations/communication-actions.js";
import * as m12 from "../../application/conversations/communications.js";
import * as m11 from "../../application/conversations/direct-chat.js";
import * as m7 from "../../application/members/role-runtime-actions.js";
import * as m10 from "../../application/members/role-runtime.js";
import * as m6 from "../../application/resources/resource-actions.js";
import * as m14 from "../../application/resources/resource-scopes.js";
import * as m4 from "../../application/runtimes/dock-actions.js";
import * as m13 from "../../application/runtimes/dock.js";
import * as m5 from "../../application/runtimes/execution-settings-actions.js";
import * as m8 from "../../application/schedules/schedule-actions.js";
import * as m9 from "../../application/schedules/schedule-data.js";
import * as m0 from "../../application/workspace/actions.js";
function bind<A extends unknown[], R>(
  app: ApplicationServices,
  fn: (app: ApplicationServices, ...args: A) => R,
): (...args: A) => R {
  return (...args) => fn(app, ...args);
}

// Explicit public operations; internal helpers are never exported as browser commands.
export function createCommands(app: ApplicationServices) {
  return {
    "projects.save": bind(app, m0.saveProject),
    "members.save": bind(app, m0.saveRole),
    "projects.changeMembership": bind(app, m0.changeMembership),
    "conversations.openPrivate": bind(app, m1.openPrivateConversation),
    "conversations.sendPrivate": bind(app, m1.sendPrivateMessage),
    "resources.saveChatResult": bind(app, m2.saveChatResult),
    "conversations.refreshConversation": bind(app, m3.refreshConversation),
    "conversations.createCommunication": bind(app, m3.createCommunication),
    "conversations.openRoleConversation": bind(app, m3.openRoleConversation),
    "conversations.postConversation": bind(app, m3.postConversation),
    "conversations.askConversation": (input: unknown) =>
      m3.askConversation(app, input),
    "conversations.discoverChatRuntimes": bind(app, m3.discoverChatRuntimes),
    "conversations.controlConversation": bind(app, m3.controlConversation),
    "conversations.controlConversationQueue": bind(
      app,
      m3.controlConversationQueue,
    ),
    "conversations.retrieveConversationOutputs": bind(
      app,
      m3.retrieveConversationOutputs,
    ),
    "conversations.handoffConversation": bind(app, m3.handoffConversation),
    "conversations.inviteConversation": bind(app, m3.inviteConversation),
    "runtimes.connectDockFromFile": bind(app, m4.connectDockFromFile),
    "runtimes.readRuntimeCapabilities": bind(app, m5.readRuntimeCapabilities),
    "resources.loadResources": bind(app, m6.loadResources),
    "resources.saveResource": bind(app, m6.saveResource),
    "resources.findResources": bind(app, m6.findResources),
    "resources.readMemorySource": bind(app, m6.readMemorySource),
    "resources.observeMemory": bind(app, m6.observeMemory),
    "resources.readKnowledgeSource": bind(app, m6.readKnowledgeSource),
    "resources.inspectResourcePlugins": bind(app, m6.inspectResourcePlugins),
    "members.setRuntime": bind(app, m7.saveRoleRuntime),
    "schedules.loadSchedules": bind(app, m8.loadSchedules),
    "schedules.loadSchedule": bind(app, m8.loadSchedule),
    "schedules.loadScheduledRun": bind(app, m8.loadScheduledRun),
    "schedules.deleteSchedule": bind(app, m8.deleteSchedule),
    "schedules.loadScheduleCalendar": bind(app, m8.loadScheduleCalendar),
    "schedules.saveSchedule": bind(app, m8.saveSchedule),
    "schedules.toggleSchedule": bind(app, m8.toggleSchedule),
    "schedules.runSchedule": bind(app, m8.runSchedule),
    "schedules.previewScheduleRule": bind(app, m8.previewScheduleRule),
    "schedules.readScheduledResult": bind(app, m8.readScheduledResult),
    "schedules.scheduleChoices": bind(app, m9.scheduleChoices),
    "members.runtimeChoices": bind(app, m10.roleRuntimeChoices),
    "conversations.direct": bind(app, m11.getDirectChat),
    "conversations.directory": bind(app, m12.readDirectory),
    "conversations.read": bind(app, m12.readConversation),
    "runtimes.renameDevice": bind(app, m13.saveRuntimeDeviceName),
    "runtimes.overview": bind(app, readRuntimeOverview),
    "runtimes.connection": bind(app, m13.getDockConnection),
    "runtimes.device": bind(app, m13.getDockDevice),
    "resources.resolveResourceScope": bind(app, m14.resolveResourceScope),
    "resources.resourceScopeOptions": bind(app, m14.resourceScopeOptions),
  } satisfies WorkbenchCommands;
}
