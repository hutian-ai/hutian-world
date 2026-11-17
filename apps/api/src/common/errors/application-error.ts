import { GatewayError as KnowledgeGatewayError } from "@hutian-ai/knowledge-gateway-client";
import { GatewayError as MemoryGatewayError } from "@hutian-ai/memory-gateway-client";
import {
  errorCodes,
  type ErrorCode,
  type Recovery,
} from "@hutian-world/contracts";
import { HttpException } from "@nestjs/common";
import { ZodError } from "zod";

/** Only explicitly public domain messages can cross the transport boundary. */
export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode = errorCodes.businessRule,
    readonly status = 422,
    readonly recovery: Recovery = "none",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApplicationError";
  }
}
export { ApplicationError as ApiError };

export function publicError(error: unknown) {
  if (error instanceof ApplicationError) return error;
  if (
    error instanceof MemoryGatewayError ||
    error instanceof KnowledgeGatewayError
  ) {
    const status = [400, 403, 404, 409, 422, 429, 503, 504].includes(
      error.status,
    )
      ? error.status
      : 502;
    const messages: Record<number, string> = {
      400: "资源请求内容无效。",
      403: "当前身份无权访问此资源。",
      404: "资源不存在或不可访问。",
      409: "原资源操作存在冲突，请核对原操作。",
      422: "资源操作不满足当前要求。",
      429: "资源服务繁忙，请稍后重试。",
      502: "资源服务返回格式未确认。",
      503: "资源服务暂不可用，请核对原操作。",
      504: "资源响应超时，请核对原操作。",
    };
    return new ApplicationError(
      messages[status]!,
      (status * 100) as ErrorCode,
      status,
      status === 409 ? "refresh" : status >= 500 ? "observe" : "none",
      { cause: error },
    );
  }
  if (error instanceof ZodError)
    return new ApplicationError(
      "输入内容有误，请核对后再提交。",
      errorCodes.invalidInput,
      400,
    );
  if (error instanceof HttpException && error.getStatus() < 500) {
    const status = error.getStatus();
    const code =
      (
        {
          400: 40000,
          401: 40100,
          403: 40300,
          404: 40400,
          409: 40900,
          410: 41000,
          422: 42200,
          429: 42900,
        } as Record<number, ErrorCode>
      )[status] ?? errorCodes.businessRule;
    return new ApplicationError(
      error.message,
      code,
      status,
      status === 401 ? "reauthenticate" : status === 409 ? "refresh" : "none",
      { cause: error },
    );
  }
  return new ApplicationError(
    "操作结果尚未确认，请核对原记录。",
    errorCodes.internal,
    500,
    "observe",
    { cause: error },
  );
}

export function actionFailure(error: unknown) {
  const failure = publicError(error);
  return {
    ok: false as const,
    error: failure.message,
    code: failure.code,
    httpStatus: failure.status,
    recovery: failure.recovery,
  };
}
