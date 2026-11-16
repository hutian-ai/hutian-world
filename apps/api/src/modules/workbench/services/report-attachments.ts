import { appDataDirectory } from "../../../config/paths.js";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { z } from "zod";
import type { ScheduledRun } from "@hutian-world/contracts";
import { api, getWorkspace } from "./api.js";
import { communicationRequest } from "./communications.js";
import { requireLocalConnection } from "./access-bindings.js";

async function reportSource() {
  await requireLocalConnection("reports");
  const path = resolve(appDataDirectory, "report-files.json");
  const info = await stat(path);
  if (info.mode & 0o077 || !info.isFile())
    throw new Error("报告附件连接未准备。");
  return z
    .object({ root: z.string(), nodeId: z.uuid() })
    .strict()
    .parse(JSON.parse(await readFile(path, "utf8")));
}
export async function scheduledResult(id: string) {
  const run = await api<ScheduledRun>(
    `/v1/scheduled-runs/${z.uuid().parse(id)}`,
  );
  if (!run.replyEventId || !run.eventId || !run.snapshot.roomId)
    throw new Error("原运行尚未交付回复，请继续观察原记录。");
  const raw = await communicationRequest(
    `/api/message?${new URLSearchParams({ roomId: run.snapshot.roomId, eventId: run.replyEventId })}`,
  );
  const message = z
    .object({
      id: z.string(),
      text: z.string(),
      sender: z.string(),
      timestamp: z.number(),
      replyTo: z.string().nullable(),
    })
    .parse(raw);
  if (message.id !== run.replyEventId || message.replyTo !== run.eventId)
    throw new Error("回复与原运行关联不一致。");
  let attachments: { name: string; href: string; sourcePath: string }[] = [];
  let outputsState: "pending" | "available" | "none" | "unconfirmed" | null =
    null;
  try {
    const source = await reportSource();
    if (source.nodeId === run.snapshot.runtime?.nodeId) {
      const root = await realpath(source.root);
      const names = new Set<string>();
      for (const match of message.text.matchAll(/\]\(([^)]+)\)/g)) {
        let path: string;
        try {
          path = decodeURIComponent(match[1]!);
        } catch {
          continue;
        }
        if (
          path.startsWith(root + sep) &&
          resolve(path) === resolve(root, basename(path)) &&
          /^[\w.-]+\.(?:md|json|csv)$/.test(basename(path))
        )
          names.add(basename(path));
      }
      attachments = [...names].map((name) => ({
        name,
        sourcePath: resolve(root, name),
        href: `/api/report-attachments?${new URLSearchParams({ run: run.id, name })}`,
      }));
    }
  } catch {
    /* A missing optional connector does not hide the original delivered text. */
  }
  // Native files belong to the exact original execution. Use the shared output
  // download path, including remote devices and binary files such as ZIPs.
  if (run.runId) {
    try {
      const role = (await getWorkspace()).roles.find(
        (item) => item.id === run.snapshot.roleId,
      );
      if (role?.chatIdentity) {
        const origin = {
          roomId: run.snapshot.roomId,
          eventId: run.eventId,
          agentId: role.chatIdentity.agentId,
          runId: run.runId,
        };
        const result = z
          .object({
            state: z.enum(["pending", "available", "none", "unconfirmed"]),
            outputs: z.array(
              z.object({
                reference: z.string(),
                name: z.string(),
                sha256: z.string(),
              }),
            ),
          })
          .parse(
            await communicationRequest(
              `/api/agent/outputs?${new URLSearchParams(origin)}`,
            ),
          );
        outputsState = result.state;
        if (result.state === "available") {
          for (const file of result.outputs) {
            attachments.push({
              name: file.name,
              sourcePath: file.reference,
              href: `/api/chat-output?${new URLSearchParams({ ...origin, reference: file.reference })}`,
            });
          }
        }
      }
    } catch {
      /* Keep the delivered answer readable while native files are unconfirmed. */
    }
  }
  return { run, message, attachments, outputsState };
}
export async function reportAttachment(id: string, name: string) {
  z.string()
    .regex(/^[\w.-]+\.(?:md|json|csv)$/)
    .max(180)
    .parse(name);
  const result = await scheduledResult(id);
  const href = `/api/report-attachments?${new URLSearchParams({ run: id, name })}`;
  if (
    !result.attachments.some((item) => item.name === name && item.href === href)
  )
    throw new Error("原交付未引用这份附件，不能读取其他文件。");
  const source = await reportSource();
  const root = await realpath(source.root),
    path = await realpath(resolve(root, name));
  if (!path.startsWith(root + sep)) throw new Error("附件不在授权目录。");
  const info = await stat(path);
  if (!info.isFile() || info.size > 5 * 1024 * 1024)
    throw new Error("附件当前不可读取或超过 5 MB。");
  return { content: await readFile(path, "utf8"), name };
}
