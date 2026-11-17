import { Inject, Injectable } from "@nestjs/common";
import { ApplicationServices } from "../../application/application-services.js";
import { createCommands } from "./commands.js";
@Injectable()
export class WorkbenchApplication {
  readonly commands: ReturnType<typeof createCommands>;
  constructor(
    @Inject(ApplicationServices) readonly services: ApplicationServices,
  ) {
    this.commands = createCommands(services);
  }
}
