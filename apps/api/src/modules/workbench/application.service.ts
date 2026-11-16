import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  chatRequestInput,
  createRoleInput,
  projectInput,
  roleInput,
  roleChatIdentityInput,
  roleRuntimeBindingInput,
  scheduleInput,
  scheduleRule,
  scheduleCalendarQuery,
} from "@hutian-world/contracts";
import { previewSchedule } from "@hutian-world/contracts/schedule-time";
import { AccessContexts } from "../access/access-context.service.js";
import { WorkspaceService } from "../workspace/workspace.service.js";
import { RolesService } from "../roles/roles.service.js";
import { ProjectsService } from "../projects/projects.service.js";
import { SchedulesService } from "../schedules/schedules.service.js";
import { ChatRequestsService } from "../chat-requests/chat-requests.service.js";
import { bindApplicationServices } from "./services/api.js";
@Injectable()
export class WorkbenchApplication {
  constructor(
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
    @Inject(WorkspaceService) private readonly workspace: WorkspaceService,
    @Inject(RolesService) private readonly roles: RolesService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(SchedulesService) private readonly schedules: SchedulesService,
    @Inject(ChatRequestsService) private readonly requests: ChatRequestsService,
  ) {
    bindApplicationServices((path, method, body) =>
      this.invoke(path, method, body),
    );
  }
  private async invoke(
    path: string,
    method: string,
    body: unknown,
  ): Promise<unknown> {
    const url = new URL(path, "http://application.local");
    const parts = url.pathname.split("/").filter(Boolean);
    const [, resource, rawId, action, other] = parts;
    const id =
      rawId && !["calendar", "preview", "rooms"].includes(rawId)
        ? z.uuid().parse(rawId)
        : rawId;
    if (resource === "access" && method === "GET")
      return this.contexts.current();
    if (resource === "workspace" && method === "GET")
      return this.workspace.overview();
    if (resource === "roles") {
      if (method === "POST" && !id)
        return this.roles.createRole(createRoleInput.parse(body));
      if (method === "PATCH" && id)
        return this.roles.updateRole(id, roleInput.parse(body));
      if (method === "PUT" && id && action === "chat-identity")
        return this.roles.bindRoleChat(id, roleChatIdentityInput.parse(body));
      if (method === "PUT" && id && action === "runtime")
        return this.roles.setRoleRuntime(
          id,
          roleRuntimeBindingInput.parse(body),
        );
    }
    if (resource === "projects") {
      if (method === "POST" && !id)
        return this.projects.createProject(projectInput.parse(body));
      if (method === "PATCH" && id)
        return this.projects.updateProject(id, projectInput.parse(body));
      if (["PUT", "DELETE"].includes(method) && id && action === "roles")
        return this.projects.membership(
          id,
          z.uuid().parse(other),
          method === "DELETE",
        );
    }
    if (resource === "chat-requests") {
      if (method === "POST" && !id)
        return this.requests.create(chatRequestInput.parse(body));
      if (method === "GET")
        return id
          ? this.requests.get(id)
          : this.requests.list(
              z.string().startsWith("!").parse(url.searchParams.get("roomId")),
            );
    }
    if (resource === "schedules") {
      if (method === "GET" && id === "rooms") return this.schedules.workRooms();
      if (method === "GET" && id === "calendar")
        return this.schedules.calendar(
          scheduleCalendarQuery.parse(Object.fromEntries(url.searchParams)),
        );
      if (method === "POST" && id === "preview")
        return { starts: previewSchedule(scheduleRule.parse(body)) };
      if (method === "GET")
        return id ? this.schedules.getTask(id) : this.schedules.list();
      if (method === "POST" && !id)
        return this.schedules.save(scheduleInput.parse(body), null);
      if (method === "PUT" && id) {
        const input = z
          .object({
            task: scheduleInput,
            expectedRevision: z.number().int().positive(),
          })
          .parse(body);
        if (input.task.id !== id) throw new Error("安排标识不匹配。");
        return this.schedules.save(input.task, input.expectedRevision);
      }
      if (method === "DELETE" && id)
        return this.schedules.remove(
          id,
          z
            .object({ expectedRevision: z.number().int().positive() })
            .parse(body).expectedRevision,
        );
      if (method === "POST" && id && action === "enabled") {
        const input = z
          .object({
            enabled: z.boolean(),
            expectedRevision: z.number().int().positive(),
          })
          .parse(body);
        return this.schedules.setEnabled(
          id,
          input.enabled,
          input.expectedRevision,
        );
      }
      if (method === "POST" && id && action === "run")
        return this.schedules.runNow(
          id,
          z.object({ requestId: z.uuid() }).parse(body).requestId,
        );
    }
    if (resource === "scheduled-runs" && id) {
      if (method === "GET") return this.schedules.getRun(id);
      if (method === "PUT" && action === "room")
        return this.schedules.recordRoom(
          id,
          z.object({ roomId: z.string().startsWith("!") }).parse(body).roomId,
        );
      if (method === "PUT" && action === "event")
        return this.schedules.recordEvent(
          id,
          z.object({ eventId: z.string().startsWith("$") }).parse(body).eventId,
        );
    }
    throw new Error("后端应用操作不存在。");
  }
}
