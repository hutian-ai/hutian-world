import { Catch, HttpException } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { ZodError } from "zod";
@Catch()
export class PublicErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500,
      message = "操作暂时未完成，请刷新后核对当前记录。";
    if (error instanceof ZodError) {
      status = 400;
      message = error.issues.map((i) => i.message).join("；");
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
    }
    // QueryFailedError details can contain submitted content. Do not forward raw SQL or environment.
    if (status === 500)
      console.error("应用操作失败；未向客户端输出数据库或配置详情。");
    host
      .switchToHttp()
      .getResponse<FastifyReply>()
      .status(status)
      .send({ message });
  }
}
