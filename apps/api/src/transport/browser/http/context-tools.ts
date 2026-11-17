import type { ApplicationServices } from "../../../application/application-services.js";
import {
  callContextTool,
  contextDefinitions,
  contextGrant,
} from "../../../application/conversations/chat-context-tools.js";
import { publicError } from "../../../common/errors/application-error.js";
export async function POST(
  app: Pick<
    ApplicationServices,
    "contexts" | "devices" | "requests" | "schedules" | "workspace"
  >,
  request: Request,
) {
  try {
    const token = (request.headers.get("authorization") ?? "").replace(
      /^Bearer /,
      "",
    );
    const body = await request.json();
    if (body.action === "describe")
      return Response.json({
        definitions: contextDefinitions((await contextGrant(app, token)).grant),
      });
    return Response.json(await callContextTool(app, token, body));
  } catch (error) {
    const failure = publicError(error);
    return Response.json(
      {
        message: failure.message,
        code: failure.code,
        recovery: failure.recovery,
      },
      { status: failure.status },
    );
  }
}
