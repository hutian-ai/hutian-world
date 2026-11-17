import type { AccessContext } from "@hutian-world/contracts";
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { Observable } from "rxjs";
import { AccessContexts } from "./access-context.service.js";
@Injectable()
export class AccessContextInterceptor implements NestInterceptor {
  constructor(
    @Inject(AccessContexts) private readonly contexts: AccessContexts,
  ) {}
  intercept(execution: ExecutionContext, next: CallHandler) {
    const context = execution
      .switchToHttp()
      .getRequest<{ hutianAccess: AccessContext }>().hutianAccess;
    if (!context) return next.handle();
    return new Observable((subscriber) =>
      this.contexts.run(context, () => {
        const subscription = next.handle().subscribe(subscriber);
        return () => subscription.unsubscribe();
      }),
    );
  }
}
