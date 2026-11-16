import {
  readConversation,
  communicationRequest,
} from "../services/communications.js";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const roomId = String(form.get("roomId") ?? "");
    await readConversation(roomId);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024)
      return Response.json({ error: "每份文件需小于 8 MB。" }, { status: 400 });
    const result = await communicationRequest("/api/uploads", {
      roomId,
      name: file.name,
      mime: file.type || "application/octet-stream",
      contentBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    });
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "文件上传未完成，草稿仍保留。" },
      { status: 400 },
    );
  }
}
