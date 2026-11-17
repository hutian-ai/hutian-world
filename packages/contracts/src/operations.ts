/** Stable public operation identifiers; independent of source filenames. */
export const operationMetadata = {
  "projects.save": {
    formResult: true,
    refresh: true,
  },
  "members.save": {
    formResult: true,
    refresh: true,
  },
  "projects.changeMembership": {
    formResult: true,
    refresh: true,
  },
  "conversations.openPrivate": {
    formResult: true,
    refresh: false,
  },
  "conversations.sendPrivate": {
    formResult: true,
    refresh: false,
  },
  "resources.saveChatResult": {
    formResult: true,
    refresh: false,
  },
  "conversations.refreshConversation": {
    formResult: true,
    refresh: false,
  },
  "conversations.createCommunication": {
    formResult: true,
    refresh: false,
  },
  "conversations.openRoleConversation": {
    formResult: true,
    refresh: false,
  },
  "conversations.postConversation": {
    formResult: true,
    refresh: false,
  },
  "conversations.askConversation": {
    formResult: true,
    refresh: false,
  },
  "conversations.discoverChatRuntimes": {
    formResult: true,
    refresh: false,
  },
  "conversations.controlConversation": {
    formResult: true,
    refresh: false,
  },
  "conversations.controlConversationQueue": {
    formResult: true,
    refresh: false,
  },
  "conversations.retrieveConversationOutputs": {
    formResult: true,
    refresh: false,
  },
  "conversations.handoffConversation": {
    formResult: true,
    refresh: false,
  },
  "conversations.inviteConversation": {
    formResult: true,
    refresh: false,
  },
  "runtimes.connectDockFromFile": {
    formResult: true,
    refresh: false,
  },
  "runtimes.readRuntimeCapabilities": {
    formResult: true,
    refresh: false,
  },
  "resources.loadResources": {
    formResult: true,
    refresh: false,
  },
  "resources.saveResource": {
    formResult: true,
    refresh: false,
  },
  "resources.findResources": {
    formResult: true,
    refresh: false,
  },
  "resources.readMemorySource": {
    formResult: true,
    refresh: false,
  },
  "resources.observeMemory": {
    formResult: true,
    refresh: false,
  },
  "resources.readKnowledgeSource": {
    formResult: true,
    refresh: false,
  },
  "resources.inspectResourcePlugins": {
    formResult: true,
    refresh: false,
  },
  "members.setRuntime": {
    formResult: true,
    refresh: true,
  },
  "schedules.loadSchedules": {
    formResult: true,
    refresh: false,
  },
  "schedules.loadSchedule": {
    formResult: true,
    refresh: false,
  },
  "schedules.loadScheduledRun": {
    formResult: true,
    refresh: false,
  },
  "schedules.deleteSchedule": {
    formResult: true,
    refresh: true,
  },
  "schedules.loadScheduleCalendar": {
    formResult: true,
    refresh: false,
  },
  "schedules.saveSchedule": {
    formResult: true,
    refresh: true,
  },
  "schedules.toggleSchedule": {
    formResult: true,
    refresh: true,
  },
  "schedules.runSchedule": {
    formResult: true,
    refresh: true,
  },
  "schedules.previewScheduleRule": {
    formResult: true,
    refresh: false,
  },
  "schedules.readScheduledResult": {
    formResult: true,
    refresh: false,
  },
  "schedules.scheduleChoices": {
    formResult: false,
    refresh: false,
  },
  "members.runtimeChoices": {
    formResult: false,
    refresh: false,
  },
  "conversations.direct": {
    formResult: false,
    refresh: false,
  },
  "conversations.directory": {
    formResult: false,
    refresh: false,
  },
  "conversations.read": {
    formResult: false,
    refresh: false,
  },
  "runtimes.renameDevice": {
    formResult: false,
    refresh: false,
  },
  "runtimes.connection": {
    formResult: false,
    refresh: false,
  },
  "runtimes.device": {
    formResult: false,
    refresh: false,
  },
  "resources.resolveResourceScope": {
    formResult: false,
    refresh: false,
  },
  "resources.resourceScopeOptions": {
    formResult: false,
    refresh: false,
  },
} as const;
