import { Module } from "@nestjs/common";
import { AccessModule } from "../access/access.module.js";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { ChatHostModule } from "../../infrastructure/chat-host/chat-host.module.js";
import { ChatRequestsService } from "./chat-requests.service.js";
import { ChatRequestsController } from "./chat-requests.controller.js";
@Module({
  imports: [AccessModule, DatabaseModule, ChatHostModule],
  controllers: [ChatRequestsController],
  providers: [ChatRequestsService],
  exports: [ChatRequestsService],
})
export class ChatRequestsModule {}
