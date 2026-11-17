/** Compatibility for already-open v1 clients only. */
export const legacyOperations: Record<string, string> = {
  "actions.saveProject": "projects.save",
  "actions.saveRole": "members.save",
  "actions.changeMembership": "projects.changeMembership",
  "chat-actions.openPrivateConversation": "conversations.openPrivate",
  "chat-actions.sendPrivateMessage": "conversations.sendPrivate",
  "chat-result-actions.saveChatResult": "resources.saveChatResult",
  "communication-actions.refreshConversation":
    "conversations.refreshConversation",
  "communication-actions.createCommunication":
    "conversations.createCommunication",
  "communication-actions.openRoleConversation":
    "conversations.openRoleConversation",
  "communication-actions.postConversation": "conversations.postConversation",
  "communication-actions.askConversation": "conversations.askConversation",
  "communication-actions.discoverChatRuntimes":
    "conversations.discoverChatRuntimes",
  "communication-actions.controlConversation":
    "conversations.controlConversation",
  "communication-actions.controlConversationQueue":
    "conversations.controlConversationQueue",
  "communication-actions.retrieveConversationOutputs":
    "conversations.retrieveConversationOutputs",
  "communication-actions.handoffConversation":
    "conversations.handoffConversation",
  "communication-actions.inviteConversation":
    "conversations.inviteConversation",
  "dock-actions.connectDockFromFile": "runtimes.connectDockFromFile",
  "execution-settings-actions.readRuntimeCapabilities":
    "runtimes.readRuntimeCapabilities",
  "resource-actions.loadResources": "resources.loadResources",
  "resource-actions.saveResource": "resources.saveResource",
  "resource-actions.findResources": "resources.findResources",
  "resource-actions.readMemorySource": "resources.readMemorySource",
  "resource-actions.observeMemory": "resources.observeMemory",
  "resource-actions.readKnowledgeSource": "resources.readKnowledgeSource",
  "resource-actions.inspectResourcePlugins": "resources.inspectResourcePlugins",
  "role-runtime-actions.saveRoleRuntime": "members.setRuntime",
  "schedule-actions.loadSchedules": "schedules.loadSchedules",
  "schedule-actions.loadSchedule": "schedules.loadSchedule",
  "schedule-actions.loadScheduledRun": "schedules.loadScheduledRun",
  "schedule-actions.deleteSchedule": "schedules.deleteSchedule",
  "schedule-actions.loadScheduleCalendar": "schedules.loadScheduleCalendar",
  "schedule-actions.saveSchedule": "schedules.saveSchedule",
  "schedule-actions.toggleSchedule": "schedules.toggleSchedule",
  "schedule-actions.runSchedule": "schedules.runSchedule",
  "schedule-actions.previewScheduleRule": "schedules.previewScheduleRule",
  "schedule-actions.readScheduledResult": "schedules.readScheduledResult",
  "schedule-data.scheduleChoices": "schedules.scheduleChoices",
  "role-runtime.roleRuntimeChoices": "members.runtimeChoices",
  "direct-chat.getDirectChat": "conversations.direct",
  "communications.readDirectory": "conversations.directory",
  "communications.readConversation": "conversations.read",
  "dock.saveRuntimeDeviceName": "runtimes.renameDevice",
  "dock.getDockConnection": "runtimes.connection",
  "dock.getDockDevice": "runtimes.device",
  "resource-scopes.resolveResourceScope": "resources.resolveResourceScope",
  "resource-scopes.resourceScopeOptions": "resources.resourceScopeOptions",
};
