"use client";
import type { Conversation } from "@/lib/communications";
export function executionLinks(
  text: string,
  roomId: string,
  job?: Conversation["jobs"][number],
) {
  return text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (link, label: string, target: string) => {
      let path = target;
      try {
        path = decodeURIComponent(target);
      } catch {
        /* Local observer cleanup can race with disconnection. */
      }
      const file = job?.activity?.outputs.find(
        (o) => o.reference === path || o.name === path,
      );
      if (file && job?.runId)
        return `[${label}](/api/chat-output?${new URLSearchParams({ roomId, eventId: job.eventId, agentId: job.agentId, runId: job.runId, reference: file.reference })})`;
      // A native path is not a Web download URL. The original reply is retained in
      // Matrix; expose a download only after the host has confirmed the exact file.
      return /^(?:file:\/\/|\/(?:Users|home|tmp|private|Volumes|var)\/|[a-z]:[\\/])/i.test(
        path,
      )
        ? label
        : link;
    },
  );
}
