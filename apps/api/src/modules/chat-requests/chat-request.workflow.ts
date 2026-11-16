import { DBOS } from "@dbos-inc/dbos-sdk";
let processor: (id: string) => Promise<boolean>;
const observeStep = DBOS.registerStep(async (id: string) => processor(id), {
  name: "chat-observe-and-deliver-v1",
  retriesAllowed: true,
  maxAttempts: 5,
  intervalSeconds: 2,
});
const coordinate = DBOS.registerWorkflow(
  async (id: string) => {
    while (!(await observeStep(id))) await DBOS.sleep(5000);
  },
  { name: "chat-request-v1" },
);
export function registerChatProcessor(value: typeof processor) {
  processor = value;
}
export async function ensureChatWorkflow(workspaceId: string, id: string) {
  await DBOS.startWorkflow(coordinate, {
    workflowID: `chat:${workspaceId}:${id}`,
  })(id);
}
