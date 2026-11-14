import { reportAttachment } from "@/lib/report-attachments";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const file = await reportAttachment(query.get("run") ?? "", query.get("name") ?? "");
    return new Response(file.content, { headers: {
      "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff",
      "cache-control": "no-store", "content-disposition": `inline; filename="${file.name}"`,
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    } });
  } catch { return new Response("这份报告附件当前不可读取，请核对原交付、会话权限与文件状态。", { status: 404 }); }
}
