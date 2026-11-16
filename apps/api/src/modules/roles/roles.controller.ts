import { SERVICE_ENDPOINT } from "../access/browser-session.service.js";
import {
  Body,
  Controller,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  ParseUUIDPipe,
  SetMetadata,
} from "@nestjs/common";
import {
  roleInput,
  createRoleInput,
  roleChatIdentityInput,
  roleRuntimeBindingInput,
} from "@hutian-world/contracts";
import { RolesService } from "./roles.service.js";
@Controller("v1")
export class RolesController {
  constructor(@Inject(RolesService) private readonly service: RolesService) {}
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
    return this.service.setRoleRuntime(id, roleRuntimeBindingInput.parse(body));
  }
}
