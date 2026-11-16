import { Module } from "@nestjs/common";
import { environment } from "./environment.js";
@Module({
  imports: [],
  controllers: [],
  providers: [{ provide: "ENV", useFactory: environment }],
  exports: ["ENV"],
})
export class ConfigModule {}
