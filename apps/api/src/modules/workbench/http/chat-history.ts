import { readConversation } from "../services/communications.js";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  try {
    const room = query.get("room");
    const cursor = query.get("cursor");
    if (!room?.startsWith("!") || !cursor || cursor.length > 4000)
      return new Response(null, { status: 400 });
    return Response.json(await readConversation(room, cursor), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("历史暂不可读取。", { status: 404 });
  }
}
