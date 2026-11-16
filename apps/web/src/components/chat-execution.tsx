"use client";

import { useMemo, type ComponentProps } from "react";
import type { ExecutionActivity } from "@hutian-world/contracts";
import { ChatExecution as ExecutionView } from "@hutian-ai/design/chat/execution";
import {
  controlConversation,
  retrieveConversationOutputs,
} from "@/lib/communication-actions";
import { projectActivity } from "./chat-execution-projection";

export { projectActivity } from "./chat-execution-projection";

type Origin = {
  roomId: string;
  eventId: string;
  agentId: string;
  runId: string;
};
type Props = Omit<
  ComponentProps<typeof ExecutionView>,
  "activity" | "projection" | "runId" | "onControl" | "onRetrieveOutputs"
> & {
  activity: ExecutionActivity;
  origin: Origin;
  references?: Array<{ id: string; title: string; url: string }>;
  configuration?: {
    label?: string | null;
    model?: string | null;
    effort?: string;
  };
};

// World owns protocol projection, authenticated URLs and execution commands.
export function ChatExecution({
  activity,
  origin,
  references: _references,
  configuration: _configuration,
  ...props
}: Props) {
  const projection = useMemo(() => projectActivity(activity), [activity]);
  const outputs = useMemo(
    () =>
      activity.outputs.map((file) => {
        const href = `/api/chat-output?${new URLSearchParams({ ...origin, reference: file.reference })}`;
        return {
          id: file.reference,
          name: file.name,
          href,
          loadPreview: async () => {
            const response = await fetch(href);
            if (!response.ok) throw new Error("成果暂不可读取");
            return response.text();
          },
        };
      }),
    [
      activity.outputs,
      origin.roomId,
      origin.eventId,
      origin.agentId,
      origin.runId,
    ],
  );
  return (
    <ExecutionView
      {...props}
      activity={{ ...activity, outputs }}
      projection={projection}
      runId={origin.runId}
      onControl={(command) => controlConversation({ ...origin, ...command })}
      onRetrieveOutputs={() => retrieveConversationOutputs(origin)}
    />
  );
}
