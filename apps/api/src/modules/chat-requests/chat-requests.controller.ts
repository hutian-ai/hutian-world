import { SERVICE_ENDPOINT } from "../access/browser-session.service.js";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  SetMetadata,
} from "@nestjs/common";
import { chatRequestInput } from "@hutian-world/contracts";
import { ChatRequestsService } from "./chat-requests.service.js";
@SetMetadata(SERVICE_ENDPOINT, true)
@Controller("v1/chat-requests")
export class ChatRequestsController {
  constructor(
    @Inject(ChatRequestsService) private readonly requests: ChatRequestsService,
  ) {}
  @Post() create(@Body() body: unknown) {
    return this.requests.create(chatRequestInput.parse(body));
  }
  @Get() list(@Query("roomId") roomId: string) {
    return this.requests.list(roomId);
  }
  @Get(":id") get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.requests.get(id);
  }
}
