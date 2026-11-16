import {
  callContextTool,
  contextDefinitions,
  contextGrant,
} from "../services/chat-context-tools.js";
export async function POST(request: Request) {
  try {
    const token = (request.headers.get("authorization") ?? "").replace(
      /^Bearer /,
      "",
    );
    const body = await request.json();
    if (body.action === "describe")
      return Response.json({
        definitions: contextDefinitions((await contextGrant(token)).grant),
      });
    return Response.json(await callContextTool(token, body));
  } catch {
    return Response.json(
      { message: "本次上下文工具未授权或来源已不可访问。" },
      { status: 403 },
    );
  }
}
