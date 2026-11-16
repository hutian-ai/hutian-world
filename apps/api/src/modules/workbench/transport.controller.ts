import { All, Controller, Inject, Req, Res, SetMetadata } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import * as context from "./http/context-tools.js";
import * as events from "./http/chat-events.js";
import * as history from "./http/chat-history.js";
import * as input from "./http/chat-input.js";
import * as output from "./http/chat-output.js";
import * as upload from "./http/chat-upload.js";
import * as attachments from "./http/report-attachments.js";
import { WorkbenchApplication } from "./application.service.js";
import { TOOL_ENDPOINT } from "../access/browser-session.service.js";
const handlers = {
  "chat-events": events,
  "chat-history": history,
  "chat-input": input,
  "chat-output": output,
  "chat-upload": upload,
  "report-attachments": attachments,
};
@Controller("api")
export class WorkbenchTransportController {
  constructor(
    @Inject(WorkbenchApplication)
    private readonly application: WorkbenchApplication,
  ) {}
  private async send(
    request: FastifyRequest,
    reply: FastifyReply,
    handler: (request: Request) => Promise<Response>,
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
      new Request(`http://127.0.0.1:3341${request.url}`, {
        method: request.method,
        headers,
        body,
        signal: abort.signal,
      }),
    );
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
    const name = req.url
      .split("?")[0]!
      .split("/")
      .pop()! as keyof typeof handlers;
    const entry = handlers[name] as {
      GET?: (request: Request) => Promise<Response>;
      POST?: (request: Request) => Promise<Response>;
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
