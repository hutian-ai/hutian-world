import { createHash } from "node:crypto";
import { z } from "zod";
import type { ApplicationServices } from "../../../application/application-services.js";
import { communicationRequest } from "../../../application/conversations/communications.js";
export async function GET(
  app: Pick<ApplicationServices, "contexts">,
  request: Request,
) {
  try {
    const value = z
      .object({
        roomId: z.string().startsWith("!"),
        eventId: z.string().startsWith("$"),
        id: z.uuid(),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    // The host authorizes current membership and the exact original message,
    // including attachments outside the most recent history page.
    const file = z
      .object({
        name: z.string(),
        sha256: z.string(),
        contentBase64: z.string().max(14 * 1024 * 1024),
      })
      .parse(
        await communicationRequest(
          app,
          `/api/input?${new URLSearchParams(value)}`,
        ),
      );
    const bytes = Buffer.from(file.contentBase64, "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
      throw new Error();
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name.replaceAll(/[\r\n]/g, ""))}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("附件当前不可读取。", { status: 404 });
  }
}
