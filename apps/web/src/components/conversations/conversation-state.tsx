"use client";
import type { Conversation } from "@/lib/communications";
import type { ExecutionActivity } from "@hutian-world/contracts";
export function mergeConversation(
  previous: Conversation | null,
  incoming: Conversation,
): Conversation {
  if (!previous || previous.room.id !== incoming.room.id) return incoming;
  return {
    ...incoming,
    agents: incoming.agents.map((agent) => {
      const previousAgent = previous.agents.find((a) => a.id === agent.id);
      const currentBinding = previousAgent?.runtimeBinding;
      return currentBinding &&
        agent.runtimeBinding &&
        currentBinding.updatedAt > agent.runtimeBinding.updatedAt
        ? { ...agent, runtimeBinding: currentBinding }
        : agent;
    }),
    messages: [
      ...new Map(
        [...previous.messages, ...incoming.messages].map((m) => [m.id, m]),
      ).values(),
    ].sort((a, b) => a.timestamp - b.timestamp),
    jobs: [
      ...new Map(
        [...previous.jobs, ...incoming.jobs].map((j) => [
          `${j.eventId}:${j.agentId}`,
          (() => {
            const old = previous.jobs.find(
              (x) => x.runId && x.runId === j.runId,
            );
            const seq = (a: ExecutionActivity | null | undefined) =>
              a?.revision ?? -1;
            return old?.activity && seq(old.activity) > seq(j.activity)
              ? { ...j, activity: old.activity }
              : j;
          })(),
        ]),
      ).values(),
    ],
  };
}
