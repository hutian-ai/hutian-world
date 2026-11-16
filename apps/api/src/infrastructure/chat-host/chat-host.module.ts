import { Module } from "@nestjs/common";
import { ConfigModule } from "../../config/config.module.js";
import { ChatHostClient } from "./chat-host.client.js";
@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [ChatHostClient],
  exports: [ChatHostClient],
})
export class ChatHostModule {}
