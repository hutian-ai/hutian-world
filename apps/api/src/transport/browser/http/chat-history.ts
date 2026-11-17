import type { ApplicationServices } from "../../../application/application-services.js";
import { readConversation } from "../../../application/conversations/communications.js";
import { ApplicationError } from "../../../common/errors/application-error.js";
export async function GET(
  app: Pick<
    ApplicationServices,
    "contexts" | "devices" | "requests" | "workspace"
  >,
  request: Request,
) {
  const query = new URL(request.url).searchParams,
    room = query.get("room"),
    cursor = query.get("cursor");
  if (!room?.startsWith("!") || !cursor || cursor.length > 4000)
    throw new ApplicationError(
      "历史位置无效，请重新读取会话。",
      40000,
      400,
      "refresh",
    );
  return Response.json(await readConversation(app, room, cursor), {
    headers: { "Cache-Control": "no-store" },
  });
}
