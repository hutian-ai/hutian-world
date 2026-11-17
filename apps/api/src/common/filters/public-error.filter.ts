import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { publicError } from "../errors/application-error.js";
@Catch()
export class PublicErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const failure = publicError(error);
    // Query strings, raw messages, bodies and causes may contain credentials or user content.
    console.error(
      JSON.stringify({
        event: "request_failed",
        requestId: request.id,
        method: request.method,
        route: request.routeOptions?.url,
        code: failure.code,
        status: failure.status,
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
    reply
      .header("x-request-id", request.id)
      .status(failure.status)
      .send(
        request.url.startsWith("/v2/")
          ? {
              code: failure.code,
              msg: failure.message,
              data: null,
              requestId: request.id,
              recovery: failure.recovery,
            }
          : { message: failure.message },
      );
  }
}
