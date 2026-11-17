import {
  createRoleInput,
  roleChatIdentityInput,
  roleInput,
  roleRuntimeBindingInput,
} from "@hutian-world/contracts";
import {
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  SetMetadata,
} from "@nestjs/common";
import { ApplicationServices } from "../../application/application-services.js";
import { setMemberRuntime } from "../../application/members/role-runtime-actions.js";
import { SERVICE_ENDPOINT } from "../../modules/access/browser-session.service.js";
import { RolesService } from "../../modules/roles/roles.service.js";
@Controller(["v1", "v2"])
export class RolesController {
  constructor(
    @Inject(RolesService) private readonly service: RolesService,
    @Inject(ApplicationServices) private readonly app: ApplicationServices,
  ) {}
  @Post("roles") createRole(@Body() body: unknown) {
    return this.service.createRole(createRoleInput.parse(body));
  }
  @Patch("roles/:id") updateRole(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateRole(id, roleInput.parse(body));
  }
  @SetMetadata(SERVICE_ENDPOINT, true)
  @Put("roles/:id/chat-identity")
  bindRoleChat(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.service.bindRoleChat(id, roleChatIdentityInput.parse(body));
  }
  @Put("roles/:id/runtime") setRoleRuntime(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    const input = roleRuntimeBindingInput.parse(body);
    return setMemberRuntime(
      this.app,
      id,
      input.runtime
        ? {
            nodeId: input.runtime.nodeId,
            provider: input.runtime.provider,
            preferences: input.runtime.preferences,
          }
        : null,
      input.expectedUpdatedAt,
    );
  }
}
