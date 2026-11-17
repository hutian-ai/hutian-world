import { All, Controller, Inject, Req, Res, SetMetadata } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import type { ApplicationServices } from "../../application/application-services.js";
import { ApplicationError } from "../../common/errors/application-error.js";
import { TOOL_ENDPOINT } from "../../modules/access/browser-session.service.js";
import { WorkbenchApplication } from "./application.service.js";
import { ConversationFeeds } from "./conversation-feeds.js";
import * as history from "./http/chat-history.js";
import * as input from "./http/chat-input.js";
import * as output from "./http/chat-output.js";
import * as upload from "./http/chat-upload.js";
import * as context from "./http/context-tools.js";
import * as attachments from "./http/report-attachments.js";
const handlers = {
  "chat-history": history,
  "chat-input": input,
  "chat-output": output,
  "chat-upload": upload,
  "report-attachments": attachments,
};
@Controller(["api", "v2/transport"])
export class WorkbenchTransportController {
  constructor(
    @Inject(ConversationFeeds) private readonly feeds: ConversationFeeds,
    @Inject(WorkbenchApplication)
    private readonly application: WorkbenchApplication,
  ) {}
  private async send(
    request: FastifyRequest,
    reply: FastifyReply,
    handler: (app: ApplicationServices, request: Request) => Promise<Response>,
  ) {
    const abort = new AbortController();
    reply.raw.once("close", () => abort.abort());
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers))
      if (typeof value === "string") headers.set(key, value);
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : Buffer.isBuffer(request.body)
        ? new Uint8Array(request.body).buffer
        : JSON.stringify(request.body);
    const response = await handler(
      this.application.services,
      new Request(`http://127.0.0.1:3341${request.url}`, {
        method: request.method,
        headers,
        body,
        signal: abort.signal,
      }),
    );
    if (
      request.url.startsWith("/v2/") &&
      response.headers.get("content-type")?.includes("application/json")
    ) {
      const data = await response.json();
      if (!response.ok)
        throw new ApplicationError(
          data.error ?? data.message ?? "操作未确认。",
          data.code ?? response.status * 100,
          response.status,
          data.recovery ?? "observe",
        );
      return reply
        .status(response.status)
        .header("x-request-id", request.id)
        .send({ code: 0, msg: "success", data, requestId: request.id });
    }
    reply.status(response.status);
    response.headers.forEach((value, key) => reply.header(key, value));
    return reply.send(
      response.body ? Readable.fromWeb(response.body as ReadableStream) : null,
    );
  }
  @SetMetadata(TOOL_ENDPOINT, true)
  @All("context-tools")
  tool(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    if (req.method !== "POST") return res.status(405).send();
    return this.send(req, res, context.POST);
  }
  @All([
    "chat-events",
    "chat-history",
    "chat-input",
    "chat-output",
    "chat-upload",
    "report-attachments",
  ])
  route(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    if (req.url.split("?")[0]?.endsWith("/chat-events"))
      return this.send(req, res, (_app, request) => this.feeds.open(request));
    const name = req.url
      .split("?")[0]!
      .split("/")
      .pop()! as keyof typeof handlers;
    const entry = handlers[name] as {
      GET?: (app: ApplicationServices, request: Request) => Promise<Response>;
      POST?: (app: ApplicationServices, request: Request) => Promise<Response>;
    };
    const handler =
      req.method === "GET"
        ? entry.GET
        : req.method === "POST"
          ? entry.POST
          : undefined;
    if (!handler) return res.status(405).send();
    return this.send(req, res, handler);
  }
}
