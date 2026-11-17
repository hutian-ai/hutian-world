import { scheduledRunUpdate } from "@hutian-world/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { ApplicationServices } from "./application-services.js";
import { dispatchChat } from "./conversations/chat-dispatch.js";
import { observeScheduledRun } from "./schedules/scheduled-runs.js";
/** Background coordination stays in-process and retains the caller's AccessContexts. */
@Injectable()
export class ExecutionApplication {
  constructor(
    @Inject(ApplicationServices) private readonly app: ApplicationServices,
  ) {}
  dispatchChat(input: { id: string; workspaceId: string; userId: string }) {
    return dispatchChat(this.app, input);
  }
  async observeScheduledRun(input: {
    id: string;
    workspaceId: string;
    runAsUserId: string;
  }) {
    return scheduledRunUpdate.parse(await observeScheduledRun(this.app, input));
  }
}
