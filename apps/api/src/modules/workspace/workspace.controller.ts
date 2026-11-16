import { Controller, Get, Put, Inject, GoneException } from "@nestjs/common";
import { WorkspaceService } from "./workspace.service.js";
@Controller("v1")
export class WorkspaceController {
  constructor(
    @Inject(WorkspaceService) private readonly service: WorkspaceService,
  ) {}
  @Get("workspace") overview() {
    return this.service.overview();
  }
  // Retired overrides remain queryable as an empty list for compatibility.
  @Get("conversation-preferences") conversationPreferences() {
    return [];
  }
  @Put("conversation-preferences") setConversationPreference() {
    throw new GoneException(
      "会话执行覆盖已停用，请刷新页面并在成员执行配置中修改。",
    );
  }
}
