import { Injectable } from "@nestjs/common";
import { scheduledRunUpdate } from "@hutian-world/contracts";
import { dispatchChat } from "../../modules/workbench/services/chat-dispatch.js";
import { observeScheduledRun } from "../../modules/workbench/services/scheduled-runs.js";
/** Background coordination stays in-process and retains the caller's AccessContexts. */
@Injectable()
export class ChatHostClient {
  dispatchChat(input: { id: string; workspaceId: string; userId: string }) {
    return dispatchChat(input);
  }
  async observeScheduledRun(input: {
    id: string;
    workspaceId: string;
    runAsUserId: string;
  }) {
    return scheduledRunUpdate.parse(await observeScheduledRun(input));
  }
}
