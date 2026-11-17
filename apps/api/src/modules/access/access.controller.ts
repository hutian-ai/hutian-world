import { Controller, Get, Inject } from "@nestjs/common";
import { AccessContexts } from "./access-context.service.js";
@Controller(["v1", "v2"])
export class AccessController {
  constructor(
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  @Get("access") access() {
    return this.contexts.current();
  }
}
