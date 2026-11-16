import { createHash } from "node:crypto";
import { z } from "zod";
import { communicationRequest } from "../services/communications.js";

export async function GET(request: Request) {
  try {
    const q = Object.fromEntries(new URL(request.url).searchParams);
    const value = z
      .object({
        roomId: z.string().startsWith("!"),
        eventId: z.string().startsWith("$"),
        agentId: z.string(),
        runId: z.uuid(),
        reference: z.string().max(2000),
      })
      .parse(q);
    // The host checks membership, the original source, agent and run, then
    // resolves only collected outputs. History pagination cannot revoke a file.
    const output = z
      .object({
        name: z.string().max(300),
        sha256: z.string(),
        contentBase64: z.string().max(24 * 1024 * 1024),
      })
      .parse(
        await communicationRequest(
          `/api/agent/output?${new URLSearchParams(value)}`,
        ),
      );
    const bytes = Buffer.from(output.contentBase64, "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== output.sha256)
      throw new Error();
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(output.name.replaceAll(/[\r\n]/g, ""))}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("文件不存在或无权读取。", { status: 404 });
  }
}
