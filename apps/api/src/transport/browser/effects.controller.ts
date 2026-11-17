import { ConversationFeeds } from "./conversation-feeds.js";
import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  SetMetadata,
} from "@nestjs/common";
import { ChatEffects } from "../../application/coordination/chat-effects.js";
import { SERVICE_ENDPOINT } from "../../modules/access/browser-session.service.js";
@SetMetadata(SERVICE_ENDPOINT, true)
@Controller("v2/operations/chat-effects")
export class EffectsController {
  constructor(
    @Inject(ConversationFeeds) private readonly feeds: ConversationFeeds,
    @Inject(ChatEffects) private readonly effects: ChatEffects,
  ) {}
  @Get("observation") observation() {
    return this.feeds.diagnostics();
  }
  @Get(":id") inspect(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.effects.inspect(id);
  }
  @Post(":id/retry") retry(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.effects.retry(id);
  }
}
