import { z } from "zod";
import { ApplicationError } from "./errors/application-error.js";
const cursorSchema = z
  .object({ at: z.string().max(80), id: z.string().min(1).max(300) })
  .strict();
export function readCursor(value?: string) {
  if (!value) return null;
  try {
    if (value.length > 1000) throw new Error();
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString()),
    );
  } catch {
    throw new ApplicationError(
      "分页位置无效，请重新读取列表。",
      40000,
      400,
      "refresh",
    );
  }
}
export function writeCursor(at: string, id: string) {
  return Buffer.from(JSON.stringify({ at, id })).toString("base64url");
}
export function pageArray<T>(
  items: T[],
  position: (item: T) => { at: string; id: string },
  cursor?: string,
  limit = 50,
) {
  const after = readCursor(cursor);
  const compare = (
    a: { at: string; id: string },
    b: { at: string; id: string },
  ) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id);
  const sorted = [...items]
    .sort((a, b) => -compare(position(a), position(b)))
    .filter((i) => !after || compare(position(i), after) < 0);
  const page = sorted.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor:
      sorted.length > limit && last
        ? writeCursor(position(last).at, position(last).id)
        : null,
    hasMore: sorted.length > limit,
  };
}

export function readDatabaseCursor(value?: string) {
  const cursor = readCursor(value);
  if (!cursor) return null;
  z.uuid().parse(cursor.id);
  z.iso.datetime({ offset: true }).parse(cursor.at);
  return cursor;
}
