import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { map } from "rxjs";
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    reply.header("x-request-id", request.id);
    return next.handle().pipe(
      map((data) =>
        request.url.startsWith("/v2/")
          ? {
              code: 0,
              msg: "success",
              data: data ?? null,
              requestId: request.id,
            }
          : data,
      ),
    );
  }
}
