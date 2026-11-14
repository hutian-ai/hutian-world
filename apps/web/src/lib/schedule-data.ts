import "server-only";
import { getWorkspace } from "./api";
import { readDirectory } from "./communications";
import { discoverChatRuntimes } from "./communication-actions";

export async function scheduleChoices() {
  const [workspace, directory, runtimes] = await Promise.all([getWorkspace(), readDirectory(), discoverChatRuntimes()]);
  return {
    roles: workspace.roles.map(({ id, name }) => ({ id, name })),
    rooms: directory.rooms,
    runtimes: runtimes.ok ? runtimes.runtimes : [],
    runtimeError: runtimes.ok ? "" : runtimes.error,
  };
}
