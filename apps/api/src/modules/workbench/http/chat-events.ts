import { setTimeout as delay } from "node:timers/promises";
import {
  readConversation,
  communicationRequest,
} from "../services/communications.js";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const roomId = new URL(request.url).searchParams.get("room");
  if (!roomId?.startsWith("!"))
    return new Response("请选择会话。", { status: 400 });
  try {
    await readConversation(roomId);
  } catch {
    return new Response("会话暂不可读取。", { status: 404 });
  }
  let closed = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let previous = "";
      const watching = new Set<string>();
      const observe = async (job: {
        agentId: string;
        eventId: string;
        runId: string;
      }) => {
        let cursor = "";
        while (!closed && !request.signal.aborted) {
          try {
            const result = (await communicationRequest(
              `/api/agent/activity-changes?${new URLSearchParams({ roomId, ...job, cursor })}`,
            )) as { cursor: string; activity?: { state: string } };
            if (closed || request.signal.aborted) return;
            if (result.cursor !== cursor)
              controller.enqueue(
                encoder.encode(
                  `event: activity\ndata: ${JSON.stringify(result)}\n\n`,
                ),
              );
            cursor = result.cursor;
            if (
              result.activity &&
              ["completed", "failed", "cancelled"].includes(
                result.activity.state,
              )
            )
              return;
          } catch {
            if (closed || request.signal.aborted) return;
            await delay(1000);
          }
        }
      };
      try {
        while (!closed && !request.signal.aborted) {
          try {
            const conversation = await readConversation(roomId);
            for (const job of conversation.jobs) {
              if (
                !job.runId ||
                watching.has(job.runId) ||
                !["running", "accepted", "preparing"].includes(job.state)
              )
                continue;
              watching.add(job.runId);
              void observe({
                agentId: job.agentId,
                eventId: job.eventId,
                runId: job.runId,
              });
            }
            const snapshot = JSON.stringify(conversation);
            if (snapshot !== previous) {
              controller.enqueue(encoder.encode(`data: ${snapshot}\n\n`));
              previous = snapshot;
            } else controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            controller.enqueue(
              encoder.encode("event: unavailable\ndata: {}\n\n"),
            );
          }
          await delay(1000, undefined, { signal: request.signal });
        }
      } catch {
        /* Client closed the observation stream. Never cancel native work. */
      } finally {
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
