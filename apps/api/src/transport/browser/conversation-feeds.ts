import type { AccessContext } from "@hutian-world/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { setTimeout as delay } from "node:timers/promises";
import { ApplicationServices } from "../../application/application-services.js";
import {
  communicationRequest,
  readConversation,
} from "../../application/conversations/communications.js";
import { ApplicationError } from "../../common/errors/application-error.js";

type Feed = {
  abort: AbortController;
  listeners: Set<ReadableStreamDefaultController<Uint8Array>>;
  snapshot: string;
  watching: Set<string>;
};
const encoder = new TextEncoder();
/** One observer per authorized user/space/room, independent of the number of browser tabs. */
@Injectable()
export class ConversationFeeds {
  private readonly feeds = new Map<string, Feed>();
  constructor(
    @Inject(ApplicationServices) private readonly app: ApplicationServices,
  ) {}
  diagnostics() {
    return {
      observers: this.feeds.size,
      subscribers: [...this.feeds.values()].reduce(
        (count, feed) => count + feed.listeners.size,
        0,
      ),
    };
  }
  onModuleDestroy() {
    for (const feed of this.feeds.values()) feed.abort.abort();
    this.feeds.clear();
  }
  async open(request: Request) {
    const roomId = new URL(request.url).searchParams.get("room");
    if (!roomId?.startsWith("!"))
      throw new ApplicationError("请选择会话。", 40000, 400);
    const context = this.app.contexts.current();
    // Every subscriber is authorized before attaching, even when an observer already exists.
    const initial = await readConversation(this.app, roomId);
    const key = JSON.stringify([
      context.workspaceId,
      context.userId,
      context.creatorId,
      context.connections,
      roomId,
    ]);
    let feed = this.feeds.get(key);
    const created = !feed;
    if (!feed) {
      feed = {
        abort: new AbortController(),
        listeners: new Set(),
        snapshot: JSON.stringify(initial),
        watching: new Set(),
      };
      this.feeds.set(key, feed);
    }
    const current = feed;
    let listener: ReadableStreamDefaultController<Uint8Array> | undefined;
    const detach = () => {
      if (listener) {
        current.listeners.delete(listener);
        try {
          listener.close();
        } catch {
          /* Local observer cleanup can race with disconnection. */
        }
        listener = undefined;
      }
      request.signal.removeEventListener("abort", detach);
      if (!current.listeners.size) {
        current.abort.abort();
        if (this.feeds.get(key) === current) this.feeds.delete(key);
      }
    };
    const stream = new ReadableStream<Uint8Array>(
      {
        start(controller) {
          listener = controller;
          current.listeners.add(controller);
          controller.enqueue(encoder.encode(`data: ${current.snapshot}\n\n`));
          request.signal.addEventListener("abort", detach, { once: true });
          if (request.signal.aborted) detach();
        },
        cancel: detach,
      },
      { highWaterMark: 8 },
    );
    if (created)
      void this.app.contexts.run(context, () =>
        this.observe(key, current, roomId, context),
      );
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }
  private emit(feed: Feed, data: string) {
    const bytes = encoder.encode(data);
    for (const listener of feed.listeners) {
      try {
        if ((listener.desiredSize ?? 0) <= 0) {
          listener.error(
            new Error("Slow observer; reconnect for a fresh snapshot"),
          );
          feed.listeners.delete(listener);
        } else listener.enqueue(bytes);
      } catch {
        feed.listeners.delete(listener);
      }
    }
    if (!feed.listeners.size) feed.abort.abort();
  }
  private async activity(
    feed: Feed,
    roomId: string,
    job: { agentId: string; eventId: string; runId: string },
  ) {
    let cursor = "";
    try {
      while (!feed.abort.signal.aborted) {
        try {
          const result = (await communicationRequest(
            this.app,
            `/api/agent/activity-changes?${new URLSearchParams({ roomId, ...job, cursor })}`,
            undefined,
            feed.abort.signal,
          )) as { cursor: string; activity?: { state: string } };
          if (feed.abort.signal.aborted) break;
          if (result.cursor !== cursor)
            this.emit(
              feed,
              `event: activity\ndata: ${JSON.stringify(result)}\n\n`,
            );
          cursor = result.cursor;
          if (
            result.activity &&
            ["completed", "failed", "cancelled"].includes(result.activity.state)
          )
            break;
        } catch {
          await delay(2000, undefined, { signal: feed.abort.signal });
        }
      }
    } catch {
      /* Observation cancellation does not cancel native execution. */
    }
  }
  private async observe(
    key: string,
    feed: Feed,
    roomId: string,
    context: AccessContext,
  ) {
    try {
      while (!feed.abort.signal.aborted) {
        try {
          await this.app.contexts.authorizeRun({
            workspaceId: context.workspaceId,
            requestedByUserId: context.userId,
            runAsUserId: context.userId,
            communicationConnectionId: context.connections.matrix!,
            runtimeConnectionId: context.connections.dock!,
          });
          const conversation = await readConversation(
            this.app,
            roomId,
            undefined,
            feed.abort.signal,
          );
          for (const job of conversation.jobs)
            if (
              job.runId &&
              !feed.watching.has(job.runId) &&
              ["running", "accepted", "preparing"].includes(job.state)
            ) {
              feed.watching.add(job.runId);
              void this.activity(feed, roomId, {
                agentId: job.agentId,
                eventId: job.eventId,
                runId: job.runId,
              });
            }
          const snapshot = JSON.stringify(conversation);
          this.emit(
            feed,
            snapshot !== feed.snapshot
              ? `data: ${snapshot}\n\n`
              : ": keep-alive\n\n",
          );
          feed.snapshot = snapshot;
        } catch {
          if (!feed.abort.signal.aborted)
            this.emit(feed, "event: unavailable\ndata: {}\n\n");
        }
        await delay(1000, undefined, { signal: feed.abort.signal });
      }
    } catch {
      /* Last observer disconnected. */
    } finally {
      if (this.feeds.get(key) === feed) this.feeds.delete(key);
      for (const listener of feed.listeners) {
        try {
          listener.close();
        } catch {
          /* Local observer cleanup can race with disconnection. */
        }
      }
      feed.listeners.clear();
    }
  }
}
