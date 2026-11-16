// Compatibility entry for previously configured local task hosts. New tasks use
// Matrix's standard runtime bridge directly. Permission policy belongs to the
// native Harness; Hutian does not classify or auto-approve its tools.
import { pathToFileURL } from "node:url";

const index = process.argv.indexOf("--runtime-bridge");
const bridgePath = index >= 0 ? process.argv[index + 1] : undefined;
if (!bridgePath) throw new Error("task_host_requires_standard_runtime_bridge");
const { runExecution } = await import(pathToFileURL(bridgePath).href);
await runExecution();
