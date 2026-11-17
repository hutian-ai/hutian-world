import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module.js";
import { AccessModule } from "../access/access.module.js";
import { ChatRequestsController } from "./chat-requests.controller.js";
import { ChatRequestsService } from "./chat-requests.service.js";
@Module({
  imports: [AccessModule, DatabaseModule],
  controllers: [ChatRequestsController],
  providers: [ChatRequestsService],
  exports: [ChatRequestsService],
})
export class ChatRequestsModule {}
