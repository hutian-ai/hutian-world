import type { ApplicationServices } from "../../../application/application-services.js";
import {
  communicationRequest,
  readConversation,
} from "../../../application/conversations/communications.js";
import { publicError } from "../../../common/errors/application-error.js";
export async function POST(
  app: Pick<
    ApplicationServices,
    "contexts" | "devices" | "requests" | "workspace"
  >,
  request: Request,
) {
  try {
    const form = await request.formData();
    const roomId = String(form.get("roomId") ?? "");
    await readConversation(app, roomId);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024)
      return Response.json({ error: "每份文件需小于 8 MB。" }, { status: 400 });
    const result = await communicationRequest(app, "/api/uploads", {
      roomId,
      name: file.name,
      mime: file.type || "application/octet-stream",
      contentBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    });
    return Response.json(result);
  } catch (error) {
    const failure = publicError(error);
    return Response.json(
      {
        error: failure.message,
        code: failure.code,
        recovery: failure.recovery,
      },
      { status: failure.status },
    );
  }
}
